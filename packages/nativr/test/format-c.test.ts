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
// Independently authored GNU R 4.6.1 black-box values and warnings; success-path errors escape.
const cases = [
  {
    group: "metadata",
    name: "observable signature",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(type=typeof(formatC),formals=formals(formatC))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(type = "closure", formals = as.pairlist(alist(x = , digits = NULL, width = NULL, format = NULL, flag = "", mode = NULL, big.mark = "", big.interval = 3L, small.mark = "", small.interval = 5L, decimal.mark = getOption("OutDec"), preserve.width = "individual", zero.print = NULL, replace.zero = TRUE, drop0trailing = FALSE))), \n    warnings = character(0)))',
  },
  {
    group: "values",
    name: "default double",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1,-1,1.23456,0.00001,123456,NA_real_,NaN,Inf,-Inf))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0", "1", "-1", "1.235", "1e-05", "1.235e+05", \n"  NA", " NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "values",
    name: "default integer",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0L,1L,-1L,123456L,NA_integer_))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0", "1", "-1", "123456", "NA"), warnings = character(0)))',
  },
  {
    group: "values",
    name: "default character",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c("a","abc",NA_character_,""))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("  a", "abc", " NA", "   "), warnings = character(0)))',
  },
  {
    group: "values",
    name: "empty kinds",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(formatC(NULL),formatC(numeric()),formatC(integer()),formatC(character()))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(character(0), character(0), character(0), character(0)), \n    warnings = character(0)))',
  },
  {
    group: "formats",
    name: "f finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="f",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0.00", "1.25", "-1.25", "12345.00", "0.00", "  NA", \n" NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "formats",
    name: "e finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="e",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0.00e+00", "1.25e+00", "-1.25e+00", "1.23e+04", \n"1.00e-05", "  NA", " NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "formats",
    name: "E finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="E",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0.00E+00", "1.25E+00", "-1.25E+00", "1.23E+04", \n"1.00E-05", "  NA", " NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "formats",
    name: "g finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="g",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("  0", "1.2", "-1.2", "1.2e+04", "1e-05", "  NA", \n" NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "formats",
    name: "G finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="G",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("  0", "1.2", "-1.2", "1.2E+04", "1E-05", "  NA", \n" NaN", " Inf", "-Inf"), warnings = character(0)))',
  },
  {
    group: "formats",
    name: "d finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="d",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("  0", "  1", " -1", "12345", "  0", " NA", " NA", \n" NA", " NA"), warnings = "NAs introduced by coercion to integer range"))',
  },
  {
    group: "formats",
    name: "s finite nonfinite",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,-1.25,12345,1e-5,NA_real_,NaN,Inf,-Inf),format="s",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("    0", " 1.25", "-1.25", "12345", "1e-05", "   NA", \n"  NaN", "  Inf", " -Inf"), warnings = "coercing argument to \\"character\\" for format=\\"s\\""))',
  },
  {
    group: "rounding",
    name: "fixed ties nearest even",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0.125,0.375,2.5,3.5),format="f",digits=2,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0.12", "0.38", "2.50", "3.50"), warnings = character(0)))',
  },
  {
    group: "rounding",
    name: "whole number ties nearest even",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(2.5,3.5,-2.5,-3.5),format="f",digits=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("2", "4", "-2", "-4"), warnings = character(0)))',
  },
  {
    group: "rounding",
    name: "negative rounded zero",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(-0.001,0.001),format="f",digits=2,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("-0.00", "0.00"), warnings = character(0)))',
  },
  {
    group: "rounding",
    name: "constructed signed zeros",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({x<-c(-1,1)/Inf;list(default=formatC(x),f=formatC(x,format="f",digits=2),e=formatC(x,format="e",digits=1),g=formatC(x,format="g",digits=2))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(default = c("-0", "0"), f = c("-0.00", "0.00"\n), e = c("-0.0e+00", "0.0e+00"), g = c(" -0", "  0")), warnings = character(0)))',
  },
  {
    group: "rounding",
    name: "large fixed no exponent",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1e22,-1e22),format="f",digits=1,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("10000000000000000000000.0", "-10000000000000000000000.0"\n), warnings = character(0)))',
  },
  {
    group: "rounding",
    name: "subnormal exponent",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1e-310,-1e-310),format="e",digits=3,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.000e-310", "-1.000e-310"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g digits -1",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,2.5,3.5,1/3,1e12,1e-6),format="g",digits=-1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("      0", "   1.25", "    2.5", "    3.5", "0.333333", \n"  1e+12", "  1e-06"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g digits 0",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,2.5,3.5,1/3,1e12,1e-6),format="g",digits=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("0", "1", "2", "4", "0.3", "1e+12", "1e-06"), \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g digits 1",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,2.5,3.5,1/3,1e12,1e-6),format="g",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c(" 0", " 1", " 2", " 4", "0.3", "1e+12", "1e-06"\n), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g digits 4",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1.25,2.5,3.5,1/3,1e12,1e-6),format="g",digits=4)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("    0", " 1.25", "  2.5", "  3.5", "0.3333", \n"1e+12", "1e-06"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "fixed default digits",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1,1.25),format="f")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.0000", "1.2500"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "fixed negative digits",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1,1.25),format="f",digits=-1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.000000", "1.250000"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "fractional digits",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25),format="f",digits=1.9)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2", "-1.2"), warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g precision cap warning",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1,digits=51)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "                                                  1", \n    warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "f bounded precision 50",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="f",digits=50,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.33333333333333331482961625624739099293947219848633", \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "f bounded precision 51",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="f",digits=51,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.333333333333333314829616256247390992939472198486328", \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "f bounded precision 100",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="f",digits=100,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.3333333333333333148296162562473909929394721984863281250000000000000000000000000000000000000000000000", \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "e bounded precision 50",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="e",digits=50,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "3.33333333333333314829616256247390992939472198486328e-01", \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "e bounded precision 51",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="e",digits=51,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "3.33333333333333314829616256247390992939472198486328e-01", \n    warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "e bounded precision 100",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="e",digits=100,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "3.33333333333333314829616256247390992939472198486328e-01", \n    warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "g bounded precision 50",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="g",digits=50,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.33333333333333331482961625624739099293947219848633", \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "g bounded precision 51",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="g",digits=51,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.33333333333333331482961625624739099293947219848633", \n    warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "g bounded precision 100",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1/3,format="g",digits=100,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "0.33333333333333331482961625624739099293947219848633", \n    warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "logical precision",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1.25,format="f",digits=TRUE)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "1.2", warnings = character(0)))',
  },
  {
    group: "digits",
    name: "character precision rejected",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1.25,format="f",digits="2",width=5))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "non-numeric argument to binary operator", warnings = character(0)))',
  },
  {
    group: "width",
    name: "character width coercion",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1.25,format="f",digits=2,width="8")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "    1.25", warnings = character(0)))',
  },
  {
    group: "width",
    name: "logical width coercion",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1.25,format="f",digits=2,width=TRUE)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "1.25", warnings = character(0)))',
  },
  {
    group: "width",
    name: "negative fractional width truncates",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(1.25,format="f",digits=2,width=-5.9)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "1.25 ", warnings = character(0)))',
  },
  {
    group: "width",
    name: "width 0",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,Inf),format="f",digits=1,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2", "-1.2", " NA", "Inf"), warnings = character(0)))',
  },
  {
    group: "width",
    name: "width 1",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,Inf),format="f",digits=1,width=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2", "-1.2", " NA", "Inf"), warnings = character(0)))',
  },
  {
    group: "width",
    name: "width 8",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,Inf),format="f",digits=1,width=8)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("     1.2", "    -1.2", "      NA", "     Inf"\n), warnings = character(0)))',
  },
  {
    group: "width",
    name: "width -8",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,Inf),format="f",digits=1,width=-8)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2     ", "-1.2    ", "NA      ", "Inf     "\n), warnings = character(0)))',
  },
  {
    group: "width",
    name: "width 1.5",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,Inf),format="f",digits=1,width=1.5)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2", "-1.2", " NA", "Inf"), warnings = character(0)))',
  },
  {
    group: "width",
    name: "explicit zero with positive precision",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(0,1,NA_real_,Inf),format="g",digits=4,width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("   0", "   1", "  NA", " Inf"), warnings = character(0)))',
  },
  {
    group: "width",
    name: "nonfinite separate group",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(formatC(NA_real_,format="f",digits=4),formatC(c(NA_real_,Inf),format="f",digits=4),formatC(c(NA_real_,Inf),format="f",digits=0),formatC(c(NA_real_,Inf),format="f",digits=4,width=0))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list("   NA", c("   NA", "  Inf"), c(" NA", "Inf"\n), c("  NA", " Inf")), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag ""',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("     1.2", "    -1.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "+"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="+")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("    +1.2", "    -1.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag " "',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag=" ")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("     1.2", "    -1.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "0"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="0")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("000001.2", "-00001.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "-"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="-")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2     ", "-1.2    ", "NA      ", "NaN     ", \n"Inf     ", "-Inf    "), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "#"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="#")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("     1.2", "    -1.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "+0"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="+0")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("+00001.2", "-00001.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "-0"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="-0")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2     ", "-1.2    ", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "0+"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="0+")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("+00001.2", "-00001.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: 'flag "++"',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,-1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag="++")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("    +1.2", "    -1.2", "      NA", "     NaN", \n"     Inf", "    -Inf"), warnings = character(0)))',
  },
  {
    group: "flags",
    name: "alternate general zeros",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1,1.2,1e5),format="g",digits=3,flag="#")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.00", "1.20", "1.00e+05"), warnings = character(0)))',
  },
  {
    group: "character",
    name: "width zero uses longest element",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c("a","long",NA_character_),format="s",width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("   a", "long", "  NA"), warnings = character(0)))',
  },
  {
    group: "character",
    name: "digits ignored",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c("abc","long"),format="s",digits=stop("digits"),width=0)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c(" abc", "long"), warnings = character(0)))',
  },
  {
    group: "character",
    name: "left aligned",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c("a","long",NA_character_),format="s",width=-5)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("a    ", "long ", "NA   "), warnings = character(0)))',
  },
  {
    group: "character",
    name: "zero and plus flags ignored",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(formatC(c("a","abc",NA_character_),flag="0",width=5),formatC(c("a","abc"),flag="+",width=5))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(c("    a", "  abc", "   NA"), c("    a", "  abc"\n)), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "integer mode and f",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.9,-1.9),mode="integer",format="f",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.00", "-1.00"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "character mode and f",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.9,-1.9),mode="character",format="f",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c(" 1.9", "-1.9"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "double mode and d",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.9,-1.9),mode="double",format="d",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("  1", " -1"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "integer promoted f",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1L,2L),format="f",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.00", "2.00"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "real alias",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.23456,1e-5),mode="real")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.235", "1e-05"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "character coerced double",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c("1.25","bad",NA_character_),mode="double",format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.2", "NA", "NA"), warnings = "NAs introduced by coercion"))',
  },
  {
    group: "coercion",
    name: "logical coerced double",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(TRUE,FALSE,NA),mode="double",format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1.0", "0.0", "NA"), warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "integer conversion warnings",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.9,-1.9,NA_real_,NaN,Inf,-Inf,2147483648),format="d",digits=3)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("   1", "  -1", "  NA", "  NA", "  NA", "  NA", \n"  NA"), warnings = "NAs introduced by coercion to integer range"))',
  },
  {
    group: "coercion",
    name: "isolated NaN d does not warn",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(NaN,format="d")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "NA", warnings = character(0)))',
  },
  {
    group: "coercion",
    name: "isolated NaN integer mode does not warn",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(NaN,mode="integer")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "NA", warnings = character(0)))',
  },
  {
    group: "digits",
    name: "d precision cap warning",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1,2),format="d",digits=51)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("                                                  1", \n"                                                  2"), warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "digits",
    name: "integer mode precision cap warning",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1,2),mode="integer",digits=51)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("                                                  1", \n"                                                  2"), warnings = "\'digits\' reduced to 50"))',
  },
  {
    group: "rounding",
    name: "fixed binary64 precision boundary 1074",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({x<-c(0.125,1e-310);y<-formatC(x,format="f",digits=1074,width=1);list(exact=identical(y,sprintf("%.1074f",x)),length=nchar(y),suffix=substr(y,1072,1076))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(exact = FALSE, length = c(326L, 326L), suffix = c("", \n"")), warnings = "\'digits\' reduced to 324"))',
  },
  {
    group: "rounding",
    name: "fixed binary64 precision boundary 1075",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({x<-c(0.125,1e-310);y<-formatC(x,format="f",digits=1075,width=1);list(exact=identical(y,sprintf("%.1075f",x)),length=nchar(y),suffix=substr(y,1073,1077))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(exact = FALSE, length = c(326L, 326L), suffix = c("", \n"")), warnings = "\'digits\' reduced to 324"))',
  },
  {
    group: "rounding",
    name: "fixed binary64 precision boundary 1200",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({x<-c(0.125,1e-310);y<-formatC(x,format="f",digits=1200,width=1);list(exact=identical(y,sprintf("%.1200f",x)),length=nchar(y),suffix=substr(y,1198,1202))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(exact = FALSE, length = c(326L, 326L), suffix = c("", \n"")), warnings = "\'digits\' reduced to 324"))',
  },
  {
    group: "attributes",
    name: "numeric named matrix metadata",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(matrix(c(1.25,NA,Inf,NaN),2,dimnames=list(c("a","b"),c("c","d"))),names=c("one","two","three","four"),class="owned",note="keep"),format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(one = "1.2", two = " NA", three = "Inf", \nfour = "NaN"), dim = c(2L, 2L), dimnames = list(c("a", "b"), \n    c("c", "d")), note = "keep"), warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "numeric scalar class drops note stays",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(1.25,names="one",class="owned",note="keep"),format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(one = "1.2"), note = "keep"), warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "factor codes levels retained",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(factor(c("a","b",NA)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c("1", "2", "NA"), levels = c("a", "b"\n)), warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "character names dims retained note drops",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(matrix(c("a","long"),1,dimnames=list("r",c("c1","c2"))),note="drop"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c("   a", "long"), dim = 1:2, dimnames = list(\n    "r", c("c1", "c2"))), warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "character vector missing names retained",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(c("a","long"),names=c(NA,""),class="owned",note="drop"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c("   a", "long"), names = c(NA, "")), \n    warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "numeric to character attributes",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(c(a=1,b=2),class="owned",note="drop"),mode="character")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c(a = "1", b = "2"), warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "character to double attributes",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(structure(c(a="1.2",b="2.3"),class="owned",note="keep"),mode="double",format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = "1.2", b = "2.3"), note = "keep"), \n    warnings = character(0)))',
  },
  {
    group: "formatting",
    name: "decimal mark",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(c(1.25,1000),format="f",digits=2,decimal.mark=",")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1,25", "1000,00"), warnings = character(0)))',
  },
  {
    group: "formatting",
    name: "decimal option",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({old<-options(OutDec=",");on.exit(options(old));formatC(c(1.25,1e5),format="f",digits=2)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = c("1,25", "100000,00"), warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC()",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC())}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "argument \\"x\\" is missing, with no default", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(stop("x"),extra=stop("extra"))',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(stop("x"),extra=stop("extra")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "unused argument (extra = stop(\\"extra\\"))", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(x=stop("x"),x=stop("second"))',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(x=stop("x"),x=stop("second")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "formal argument \\"x\\" matched by multiple actual arguments", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(TRUE)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(TRUE))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "unsupported type ", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1+2i)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1+2i))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "unsupported type ", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(as.raw(1))",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(as.raw(1)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "unsupported type ", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(list(1))",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(list(1)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "default method not implemented for type \'list\'", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(1,format="bad")',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,format="bad"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'format\' must be one of {\\"f\\",\\"e\\",\\"E\\",\\"g\\",\\"G\\", \\"fg\\", \\"s\\"}", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(1,mode="bad")',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,mode="bad"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'mode\' must be \\"double\\" (\\"real\\"), \\"integer\\" or \\"character\\"", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(1,flag="bad")',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,flag="bad"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'flag\' should contain only characters from [0+- #\'I]", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(NULL,flag=NA)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(NULL,flag=NA))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'flag\' should contain only characters from [0+- #\'I]", \n    warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,width=0,digits=0)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,width=0,digits=0))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "width cannot be zero", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,width=NA)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,width=NA))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "missing value where TRUE/FALSE needed", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,width=c(1,2))",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,width=c(1,2)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "the condition has length > 1", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,digits=NA)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,digits=NA))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "missing value where TRUE/FALSE needed", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,digits=character())",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,digits=character()))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "argument is of length zero", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,flag=NULL)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,flag=NULL))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'flag\' must be a character string", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: 'formatC(1,flag=c("+","-"))',
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,flag=c("+","-")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'flag\' must be a character string", warnings = character(0)))',
  },
  {
    group: "diagnostics",
    name: "formatC(1,decimal.mark=NULL)",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,decimal.mark=NULL))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "missing value where TRUE/FALSE needed", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "double order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x",1.25),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list("1.25", c("x", "flag", "mode", "format", "width", \n"digits", "big.mark", "small.mark", "decimal.mark", "zero.print", \n"drop0trailing")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "integer order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x",1L),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list("1", c("x", "flag", "mode", "format", "width", \n"digits", "big.mark", "small.mark", "decimal.mark", "zero.print", \n"drop0trailing")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "character order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x","abc"),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list("abc", c("x", "flag", "mode", "width")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "NULL order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x",NULL),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(character(0), c("x", "flag")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "empty order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x",numeric()),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(character(0), c("x", "flag")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "nonfinite order",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({events<-character();m<-function(k,v){events<<-c(events,k);v};value<-formatC(m("x",c(NA_real_,Inf)),digits=m("digits",NULL),width=m("width",NULL),format=m("format",NULL),flag=m("flag",""),mode=m("mode",NULL),big.mark=m("big.mark",""),big.interval=m("big.interval",3L),small.mark=m("small.mark",""),small.interval=m("small.interval",5L),decimal.mark=m("decimal.mark","."),preserve.width=m("preserve.width","individual"),zero.print=m("zero.print",NULL),replace.zero=m("replace.zero",TRUE),drop0trailing=m("drop0trailing",FALSE));list(value,events)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(c(" NA", "Inf"), c("x", "flag", "mode", "format", \n"width", "digits", "big.mark", "small.mark", "decimal.mark", \n"zero.print", "drop0trailing")), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "x first",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(stop("x"),flag=stop("flag")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "x", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "flag before mode",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,flag=stop("flag"),mode=stop("mode")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "flag", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "mode before format",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,mode=stop("mode"),format=stop("format")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "mode", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "width before digits",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,width=stop("width"),digits=stop("digits")))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "width", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "empty lazy postcontrols",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC(NULL,digits=stop("digits"),format=stop("format"),big.mark=stop("big"),decimal.mark=stop("decimal"),zero.print=stop("zero"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = character(0), warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "character lazy controls",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC("abc",format=stop("format"),digits=stop("digits"),zero.print=stop("zero"),replace.zero=stop("replace"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "abc", warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "invalid flag before invalid mode",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,flag="bad",mode="bad"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'flag\' should contain only characters from [0+- #\'I]", \n    warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "invalid mode before invalid format",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,mode="bad",format="bad"))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'mode\' must be \\"double\\" (\\"real\\"), \\"integer\\" or \\"character\\"", \n    warnings = character(0)))',
  },
  {
    group: "forcing",
    name: "invalid format before invalid width",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({err(formatC(1,format="bad",width=NA))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "\'format\' must be one of {\\"f\\",\\"e\\",\\"E\\",\\"g\\",\\"G\\", \\"fg\\", \\"s\\"}", \n    warnings = character(0)))',
  },
  {
    group: "matching",
    name: "partial argument warnings",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({old<-options(warnPartialMatchArgs=TRUE);on.exit(options(old));formatC(1.25,dig=1,form="f")}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = "1.2", warnings = c("partial argument match of \'dig\' to \'digits\'", \n"partial argument match of \'form\' to \'format\'")))',
  },
  {
    group: "visibility",
    name: "direct visible",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({withVisible(formatC(1.25,format="f",digits=1))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(value = "1.2", visible = TRUE), warnings = character(0)))',
  },
  {
    group: "dispatch",
    name: "formatC class method ignored",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({formatC.owned<-function(x,...)stop("method");formatC(structure(1.2,class="owned",note="keep"),format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure("1.2", note = "keep"), warnings = character(0)))',
  },
  {
    group: "dispatch",
    name: "coercion class method ignored",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({as.double.owned<-function(x,...)stop("coerce method");assign("as.double.owned",as.double.owned,.GlobalEnv);on.exit(rm("as.double.owned",envir=.GlobalEnv));formatC(structure(c(a=1L,b=2L),class="owned",note="keep"),mode="double",format="f",digits=1)}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = structure(c(a = "1.0", b = "2.0"), note = "keep"), \n    warnings = character(0)))',
  },
  {
    group: "attributes",
    name: "missing names and reference attribute",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({shared<-new.env();x<-structure(c(1.25,NA_real_),names=c(NA_character_,""),note=shared,class="owned");y<-formatC(x,format="f",digits=1);list(names=names(y),identity=identical(attr(y,"note"),shared))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value=list(names=c(NA_character_,""),identity=TRUE),warnings=character()))',
  },
  {
    group: "digits",
    name: "f precision cap boundary 324",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(value=formatC(0.125,format="f",digits=324,width=1),defaultWidth=nchar(formatC(c(NA_real_,Inf),format="f",digits=324)),zeroWidth=nchar(formatC(c(NA_real_,Inf),format="f",digits=324,width=0)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(value = "0.125000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", \n    defaultWidth = c(325L, 325L), zeroWidth = c(324L, 324L)), \n    warnings = character(0)))',
  },
  {
    group: "digits",
    name: "f precision cap boundary 325",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({list(value=formatC(0.125,format="f",digits=325,width=1),defaultWidth=nchar(formatC(c(NA_real_,Inf),format="f",digits=325)),zeroWidth=nchar(formatC(c(NA_real_,Inf),format="f",digits=325,width=0)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(value = "0.125000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", \n    defaultWidth = c(325L, 325L), zeroWidth = c(324L, 324L)), \n    warnings = c("\'digits\' reduced to 324", "\'digits\' reduced to 324", \n    "\'digits\' reduced to 324")))',
  },
  {
    group: "flags",
    name: "nonfinite alignment exact minus or negative width",
    code: 'identical(local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);warnings<-character();value<-withCallingHandlers(local({lapply(c("-","-0","0-","--","-+","+-"),function(flag)list(positive=formatC(c(1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=8,flag=flag),negative=formatC(c(1.25,NA_real_,NaN,Inf,-Inf),format="f",digits=1,width=-8,flag=flag)))}),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});list(value=value,warnings=warnings)}),list(value = list(list(positive = c("1.2     ", "NA      ", "NaN     ", \n"Inf     ", "-Inf    "), negative = c("1.2     ", "NA      ", \n"NaN     ", "Inf     ", "-Inf    ")), list(positive = c("1.2     ", \n"      NA", "     NaN", "     Inf", "    -Inf"), negative = c("1.2     ", \n"NA      ", "NaN     ", "Inf     ", "-Inf    ")), list(positive = c("1.2     ", \n"      NA", "     NaN", "     Inf", "    -Inf"), negative = c("1.2     ", \n"NA      ", "NaN     ", "Inf     ", "-Inf    ")), list(positive = c("1.2     ", \n"      NA", "     NaN", "     Inf", "    -Inf"), negative = c("1.2     ", \n"NA      ", "NaN     ", "Inf     ", "-Inf    ")), list(positive = c("+1.2    ", \n"      NA", "     NaN", "     Inf", "    -Inf"), negative = c("+1.2    ", \n"NA      ", "NaN     ", "Inf     ", "-Inf    ")), list(positive = c("+1.2    ", \n"      NA", "     NaN", "     Inf", "    -Inf"), negative = c("+1.2    ", \n"NA      ", "NaN     ", "Inf     ", "-Inf    "))), warnings = character(0)))',
  },
] as const;
it.each(cases)("$group: $name", async ({ code }) => {
  await runtime.reset();
  expect(await runtime.eval(code)).toBe(true);
});

it("keeps exact binary64 high-precision rendering separately from native parity", async () => {
  // The Windows oracle formats this same input bit pattern differently. This is an owned exact
  // decimal regression, not native compatibility evidence; the native discrepancy is deferred.
  expect(await runtime.eval('formatC(1e-6,format="g",digits=22,width=1)')).toBe(
    "9.999999999999999547481e-07",
  );
});

it("rejects oversized padding/precision before allocation and recovers", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxOutputBytes: 512 } });
  try {
    for (const source of [
      "formatC(1, width=1e12)",
      'formatC("a", width=-1e12)',
      "formatC(c(1,2), width=300)",
      'formatC(c(1,2), format="f", digits=300, width=1)',
      'formatC(c(1,2), format="f", digits=1e12, width=1)',
    ]) {
      await expect(limited.eval(source)).rejects.toMatchObject({ code: "NRL4007" });
      expect(await limited.eval('identical(formatC(1.25,format="f",digits=2),"1.25")')).toBe(true);
      expect(await limited.eval("sys.nframe()")).toBe(0);
    }
    expect(await limited.eval('nchar(formatC(1,format="f",digits=1e12,width=1))')).toBe(326);
    expect(await limited.eval("1+1")).toBe(2);
  } finally {
    await limited.dispose();
  }
});

it("bounds formatC loops and recovers without changing input", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 1024, maxSteps: 300 },
  });
  try {
    await limited.assign("x", new Float64Array(500).fill(1.25));
    await expect(limited.eval('formatC(x,format="f",digits=2)')).rejects.toMatchObject({
      code: "NRL4001",
    });
    expect(await limited.eval("length(x)")).toBe(500);
    expect(await limited.eval("x[[1]]")).toBe(1.25);
    expect(await limited.eval("sys.nframe()")).toBe(0);
    expect(await limited.eval("1+1")).toBe(2);
  } finally {
    await limited.dispose();
  }
});

it("reports deferred formatting controls explicitly", async () => {
  for (const source of [
    'formatC(1,format="fg")',
    'formatC(1,big.mark=",")',
    'formatC(0,zero.print="zero")',
    "formatC(1,drop0trailing=TRUE)",
    'formatC("a\\tb")',
    'formatC("caf\\u00e9")',
    'formatC(1,decimal.mark="..")',
    'formatC(1,flag="I")',
  ]) {
    await expect(runtime.eval(source)).rejects.toMatchObject({ code: "NRU6256" });
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  }
});
