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
// Independently authored GNU R 4.6.1 black-box observations, C locale.
const cases = [
  {
    id: "default-relative-thirds",
    code: "all.equal(3,4,tolerance=0)",
    expected: "Mean relative difference: 0.3333333",
    warnings: [],
  },
  {
    id: "digits-three",
    code: "options(digits=3); all.equal(3,4,tolerance=0)",
    expected: "Mean relative difference: 0.333",
    warnings: [],
  },
  {
    id: "digits-fifteen",
    code: "options(digits=15); all.equal(3,4,tolerance=0)",
    expected: "Mean relative difference: 0.333333333333333",
    warnings: [],
  },
  {
    id: "digits-twenty-two",
    code: "options(digits=22); all.equal(3,4,tolerance=0)",
    expected: "Mean relative difference: 0.3333333333333333148296",
    warnings: [],
  },
  {
    id: "explicit-digits-dot-argument",
    code: "all.equal(3,4,tolerance=0,digits=3)",
    expected: "Mean relative difference: 0.3333333",
    warnings: [],
  },
  {
    id: "tiny-default",
    code: "all.equal(0,6.618483539000408e-12,tolerance=0)",
    expected: "Mean absolute difference: 6.618484e-12",
    warnings: [],
  },
  {
    id: "tiny-high-scipen",
    code: "options(scipen=999); all.equal(0,6.618483539000408e-12,tolerance=0)",
    expected: "Mean absolute difference: 0.000000000006618484",
    warnings: [],
  },
  {
    id: "out-dec-comma",
    code: 'options(OutDec=","); all.equal(3,4,tolerance=0)',
    expected: "Mean relative difference: 0,3333333",
    warnings: [],
  },
  {
    id: "absolute-small-default",
    code: "all.equal(0,0.000123456789,tolerance=0)",
    expected: "Mean absolute difference: 0.0001234568",
    warnings: [],
  },
  {
    id: "absolute-large-default",
    code: "all.equal(0,1234567.89,tolerance=0)",
    expected: "Mean absolute difference: 1234568",
    warnings: [],
  },
  {
    id: "automatic-unit-scale-label",
    code: "all.equal(1,1.125,tolerance=0)",
    expected: "Mean relative difference: 0.125",
    warnings: [],
  },
  {
    id: "explicit-unit-scale-label",
    code: "all.equal(1,1.125,tolerance=0,scale=1)",
    expected: "Mean absolute difference: 0.125",
    warnings: [],
  },
  {
    id: "explicit-double-scale-label",
    code: "all.equal(1,1.125,tolerance=0,scale=2)",
    expected: "Mean scaled difference: 0.0625",
    warnings: [],
  },
  {
    id: "explicit-near-unit-scale-label",
    code: "all.equal(1,1.125,tolerance=0,scale=1+1e-8)",
    expected: "Mean absolute difference: 0.125",
    warnings: [],
  },
  {
    id: "explicit-not-near-unit-scale-label",
    code: "all.equal(1,1.125,tolerance=0,scale=1+1e-6)",
    expected: "Mean scaled difference: 0.1249999",
    warnings: [],
  },
  {
    id: "custom-format-function",
    code: 'local({ calls <- list(); result <- all.equal(3,4,tolerance=0,formatFUN=function(err,what) { calls[[length(calls)+1L]] <<- list(err=err,what=what); paste0("custom:",what,":",sprintf("%.17g",err)) }); list(result=result,calls=calls) })',
    expected: [
      "Mean relative difference: custom:relative:0.33333333333333331",
      [[0.3333333333333333, "relative"]],
    ],
    warnings: [],
  },
  {
    id: "custom-format-function-unneeded",
    code: 'local({ count <- 0L; result <- all.equal(3,4,tolerance=1,formatFUN=function(err,what) { count <<- count+1L; "formatted" }); list(result=result,count=count) })',
    expected: [true, 0],
    warnings: [],
  },
  {
    id: "give-err-relative",
    code: "all.equal(3,4,tolerance=0,giveErr=TRUE)",
    expected: "Mean relative difference: 0.3333333",
    warnings: [],
  },
  {
    id: "give-err-within-tolerance",
    code: "all.equal(3,4,tolerance=1,giveErr=TRUE)",
    expected: true,
    warnings: [],
  },
  {
    id: "give-err-identical",
    code: "all.equal(3,3,giveErr=TRUE)",
    expected: true,
    warnings: [],
  },
  {
    id: "count-equal-missing",
    code: "all.equal(c(NA_real_,2,2),c(NA_real_,2,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "count-equal-false-missing",
    code: "all.equal(c(NA_real_,2,2),c(NA_real_,2,3),tolerance=0,countEQ=FALSE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.5",
    warnings: [],
  },
  {
    id: "complex-default",
    code: "all.equal(3+0i,4+1i,tolerance=0,giveErr=TRUE)",
    expected: "Mean relative Mod difference: 0.4714045",
    warnings: [],
  },
  {
    id: "scale-vector",
    code: "all.equal(c(1,2),c(2,4),tolerance=0,scale=c(1,2),giveErr=TRUE)",
    expected: "Mean scaled difference: 1",
    warnings: [],
  },
  {
    id: "scipen-valid-negative",
    code: "options(scipen=-9); all.equal(3,4,tolerance=0)",
    expected: "Mean relative difference: 3.333333e-01",
    warnings: [],
  },
  {
    id: "default-format-equivalence",
    code: 'local({ r <- all.equal(0,6.618483539000408e-12,tolerance=0,giveErr=TRUE); list(result=r,formatted=format(attr(r,"err")),direct=format(6.618483539000408e-12)) })',
    expected: ["Mean absolute difference: 6.618484e-12", "6.618484e-12", "6.618484e-12"],
    warnings: [],
  },
  {
    id: "count-equal-ordinary",
    code: "all.equal(c(2,2),c(2,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.25",
    warnings: [],
  },
  {
    id: "count-equal-zero-tolerance-missing",
    code: 'all.equal(c(NA_real_,2,2),c(NA_real_,2,3),tolerance=0,countEQ=TRUE,formatFUN=function(err,what)paste(what,sprintf("%.17g",err)))',
    expected: "Mean absolute difference: absolute 1",
    warnings: [],
  },
  {
    id: "count-equal-positive-tolerance-missing",
    code: "all.equal(c(NA_real_,2,2),c(NA_real_,2,3),tolerance=1e-8,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "count-equal-explicit-unit-missing",
    code: "all.equal(c(NA_real_,2,2),c(NA_real_,2,3),tolerance=0,countEQ=TRUE,scale=1,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "sum-large-plus-small",
    code: 'all.equal(c(1e16,1,1),c(0,0,0),scale=1,tolerance=0,formatFUN=function(err,what)sprintf("%.17g",err),giveErr=TRUE)',
    expected: "Mean absolute difference: 3333333333333334",
    warnings: [],
  },
  {
    id: "exact-input-relative-control",
    code: "local({target<-c(2,4,8);current<-c(2.125,4.25,8.5);list(result=all.equal(target,current,tolerance=0),ratio=sum(abs(target-current))/sum(abs(target)))})",
    expected: ["Mean relative difference: 0.0625", 0.0625],
    warnings: [],
  },
  {
    id: "format-positive-exponent",
    code: "all.equal(0,1.23456789e+12,tolerance=0)",
    expected: "Mean absolute difference: 1.234568e+12",
    warnings: [],
  },
  {
    id: "format-default-scalar-api",
    code: "format(6.618483539000408e-12)",
    expected: "6.618484e-12",
    warnings: [],
  },
  {
    id: "format-digits-scalar-api",
    code: "options(digits=3);format(1/3)",
    expected: "0.333",
    warnings: [],
  },
  {
    id: "format-high-scipen-scalar-api",
    code: "options(scipen=999);format(6.618483539000408e-12)",
    expected: "0.000000000006618484",
    warnings: [],
  },
  {
    id: "ceq-missing-a",
    code: "all.equal(c(NA,0,0),c(NA,0,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 3",
    warnings: [],
  },
  {
    id: "ceq-missing-b",
    code: "all.equal(c(NA,0,0,0),c(NA,0,3,0),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 3",
    warnings: [],
  },
  {
    id: "ceq-missing-c",
    code: "all.equal(c(NA,2,2,2,2),c(NA,2,3,2,2),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "ceq-missing-d",
    code: "all.equal(c(NA,NA,2,2),c(NA,NA,2,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "ceq-inf",
    code: "all.equal(c(Inf,2,2),c(Inf,2,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "ceq-target-equal-magnitude",
    code: "all.equal(c(100,2),c(100,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.009803922",
    warnings: [],
  },
  {
    id: "ceq-target-two",
    code: "all.equal(c(100,2,4),c(100,3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.01456311",
    warnings: [],
  },
  {
    id: "ceq-na-all-diff",
    code: "all.equal(c(NA,2,4),c(NA,3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean absolute difference: 1.5",
    warnings: [],
  },
  {
    id: "scale-equal-selection",
    code: "all.equal(c(1,2,3),c(1,4,9),tolerance=0,scale=c(10,2,3),giveErr=TRUE)",
    expected: "Mean scaled difference: 1.5",
    warnings: [],
  },
  {
    id: "scale-short",
    code: "all.equal(c(1,2,3),c(2,4,9),tolerance=0,scale=c(2,3),giveErr=TRUE)",
    expected: "Mean scaled difference: 1.388889",
    warnings: ["longer object length is not a multiple of shorter object length"],
  },
  {
    id: "scale-long",
    code: "all.equal(c(1,2),c(2,4),tolerance=0,scale=c(2,3,4),giveErr=TRUE)",
    expected: "Mean scaled difference: 0.7083333",
    warnings: ["longer object length is not a multiple of shorter object length"],
  },
  {
    id: "scale-near-exact",
    code: "all.equal(1,2,tolerance=0,scale=1+1e-8,giveErr=TRUE)",
    expected: "Mean absolute difference: 1",
    warnings: [],
  },
  {
    id: "scale-inf",
    code: "all.equal(1,2,tolerance=0,scale=Inf,giveErr=TRUE)",
    expected: true,
    warnings: [],
  },
  {
    id: "list-giveerr",
    code: "all.equal(list(3,5),list(4,6),tolerance=0,giveErr=TRUE)",
    expected: [
      "Component 1: Mean relative difference: 0.3333333",
      "Component 2: Mean relative difference: 0.2",
    ],
    warnings: [],
  },
  {
    id: "callback-number",
    code: "all.equal(1,2,tolerance=0,formatFUN=function(err,what) c(1,2),giveErr=TRUE)",
    expected: ["Mean relative difference: 1", "Mean relative difference: 2"],
    warnings: [],
  },
  {
    id: "callback-empty",
    code: "all.equal(1,2,tolerance=0,formatFUN=function(err,what) character(),giveErr=TRUE)",
    expected: "Mean relative difference: ",
    warnings: [],
  },
  {
    id: "callback-lazy",
    code: "all.equal(1,1,formatFUN=stop('bad'))",
    expected: true,
    warnings: [],
  },
  {
    id: "positional-controls",
    code: "all.equal(1,1.1,0.2)",
    expected: true,
    warnings: [],
  },
  {
    id: "count-scale-label",
    code: "all.equal(c(1,1),c(1,2),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.5",
    warnings: [],
  },
  {
    id: "zeros",
    code: "all.equal(c(0,0),c(1,2),tolerance=0,giveErr=TRUE)",
    expected: "Mean absolute difference: 1.5",
    warnings: [],
  },
  {
    id: "huge",
    code: "all.equal(c(1e308,1e308),c(0,0),scale=1,tolerance=0,giveErr=TRUE)",
    expected: "Mean absolute difference: 1e+308",
    warnings: [],
  },
  {
    id: "numeric-format",
    code: "list(format(c(1/3,1e-12)),format(c(1,1.23456),nsmall=2),format(c(NA,NaN,Inf,-Inf)),format(c(1.2,100),scientific=FALSE),format(1/3,scientific=TRUE))",
    expected: [
      ["3.333333e-01", "1.000000e-12"],
      ["1.00000", "1.23456"],
      ["  NA", " NaN", " Inf", "-Inf"],
      ["  1.2", "100.0"],
      "3.333333e-01",
    ],
    warnings: [],
  },
  {
    id: "multi-diff",
    code: "all.equal(c(100,2,4),c(100,3,6),tolerance=0,countEQ=TRUE,scale=1,giveErr=TRUE)",
    expected: "Mean absolute difference: 1.5",
    warnings: [],
  },
  {
    id: "noeq",
    code: "all.equal(c(2,4),c(3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.5",
    warnings: [],
  },
  {
    id: "equal-zero",
    code: "all.equal(c(0,2,4),c(0,3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.5",
    warnings: [],
  },
  {
    id: "equal-two",
    code: "all.equal(c(2,2,4),c(2,3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.3",
    warnings: [],
  },
  {
    id: "eq2-diff1",
    code: "all.equal(c(2,2,2),c(2,2,3),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.25",
    warnings: [],
  },
  {
    id: "eq2-diff2",
    code: "all.equal(c(2,2,2,4),c(2,2,3,6),tolerance=0,countEQ=TRUE,giveErr=TRUE)",
    expected: "Mean relative difference: 0.3",
    warnings: [],
  },
  {
    id: "nae-scale2",
    code: "all.equal(c(NA,2,4),c(NA,3,6),tolerance=0,countEQ=TRUE,scale=2,giveErr=TRUE)",
    expected: "Mean scaled difference: 0.75",
    warnings: [],
  },
  {
    id: "eq-inf-scale",
    code: "all.equal(c(Inf,2,4),c(Inf,3,6),tolerance=0,countEQ=TRUE,scale=2,giveErr=TRUE)",
    expected: "Mean scaled difference: 0.75",
    warnings: [],
  },
  {
    id: "na-false",
    code: "all.equal(c(NA,2,4),c(NA,3,6),tolerance=0,countEQ=FALSE,scale=2,giveErr=TRUE)",
    expected: "Mean scaled difference: 0.75",
    warnings: [],
  },
  {
    id: "infdiff",
    code: "all.equal(c(Inf,2),c(1,3),tolerance=0,giveErr=TRUE)",
    expected: "Mean absolute difference: Inf",
    warnings: [],
  },
  {
    id: "format-attrs",
    code: "format(structure(matrix(1:4,2,dimnames=list(c('a','b'),c('x','y'))),note='a'))",
    expected: ["1", "2", "3", "4"],
    warnings: [],
  },
  {
    id: "cat-numeric-default",
    code: "capture.output(cat(c(1,1.2,1/3,1e-12,1e12),sep='|'))",
    expected: "1|1.2|0.3333333|1e-12|1e+12",
    warnings: [],
  },
  {
    id: "cat-numeric-digits",
    code: "local({old<-options(digits=3);on.exit(options(old));capture.output(cat(c(1/3,6.618483539000408e-12,12345.6789),sep='|'))})",
    expected: "0.333|6.62e-12|12346",
    warnings: [],
  },
  {
    id: "cat-numeric-scipen",
    code: "local({old<-options(scipen=999);on.exit(options(old));capture.output(cat(c(1e-12,6.618483539000408e-12,1/3),sep='|'))})",
    expected: "0.000000000001|0.000000000006618484|0.3333333",
    warnings: [],
  },
  {
    id: "cat-numeric-outdec",
    code: "local({old<-options(OutDec=',');on.exit(options(old));capture.output(cat(c(1/3,1.2),sep='|'))})",
    expected: "0,3333333|1,2",
    warnings: [],
  },
  {
    id: "cat-numeric-nonfinite",
    code: "capture.output(cat(c(NA_real_,NaN,Inf,-Inf,-0),sep='|'))",
    expected: "NA|NaN|Inf|-Inf|0",
    warnings: [],
  },
  {
    id: "cat-numeric-complex",
    code: "capture.output(cat(c(1+2i,1/3+1/7*1i,0+0i),sep='|'))",
    expected: "1+2i|0.3333333+0.1428571i|0+0i",
    warnings: [],
  },
  {
    id: "cat-numeric-visibility",
    code: 'local({out<-capture.output(v<-withVisible(cat(c(6.618483539000408e-12,1/3),sep="|")));list(out,v)})',
    expected: ["6.618484e-12|0.3333333", [null, false]],
    warnings: [],
  },
];
for (const c of cases)
  it(c.id, async () => {
    await runtime.reset();
    const result = await runtime.evalDetailed(c.code);
    const actual: unknown = JSON.parse(
      JSON.stringify(result.value, (_key: string, value: unknown) =>
        value === Infinity ? "__Infinity__" : value === -Infinity ? "__NegativeInfinity__" : value,
      ),
    );
    expect(actual).toEqual(c.expected);
    expect(result.warnings.map((w) => w.message)).toEqual(c.warnings);
  });
