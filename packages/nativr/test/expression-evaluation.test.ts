import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000000, maxCallDepth: 128, maxVectorLength: 10000, maxOutputBytes: 65536 },
  });
});
afterAll(async () => runtime.dispose());
// Independently authored GNU R 4.6.1 fixtures; exact sampled messages only.
// The original incorrect empty-result visibility assumption is preserved in the verification record.
const cases = [
  {
    id: "missing-expression-cell",
    cohort: "diagnostic",
    code: 'tryCatch({eval(as.expression(list(quote(expr=))));FALSE},error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "4f6f477091dc62d2a471174d2553c3d85bde8f0aff8489aa469d024f0d1d951e",
  },
  {
    id: "missing-cell-stops-sequence",
    cohort: "value",
    code: 'local({observed<-local({events<-character();x<-as.expression(list(\n    quote({events<-c(events,"before");11L}),quote(expr=),quote({events<-c(events,"after");29L})))\n    message<-tryCatch(eval(x),error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);conditionMessage(e)})\n    list(events=events,message=message)});identical(observed,list(events="before",message="argument is missing, with no default"))})',
    sourceSha256: "87032f8f777e3a057e6443d70e4c0cddf2a77c5ce3e0a6aa44da58b0862c2fe6",
  },
  {
    id: "named-missing-promise-distinction",
    cohort: "diagnostic",
    code: 'tryCatch({local({f<-function(x)x;f()});FALSE},error=function(e){if(!identical(conditionMessage(e),"argument \\"x\\" is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "218783628e97b4d9f3eeecd27e789c61c2f6c82a6923a076a8deda76c77cdf4f",
  },
  {
    id: "ordinary-sequence-visible-final",
    cohort: "value",
    code: 'local({observed<-local({events<-character();result<-withVisible(eval(expression(\n    {events<-c(events,"first");11L},{events<-c(events,"second");22L})))\n    list(value=result$value,visible=result$visible,events=events)});identical(observed,list(value=22L,visible=TRUE,events=c("first","second")))})',
    sourceSha256: "3a14df53a1d448bb2da4e33bbc24df5b88b26ad0b6dd7edfb3d2eb7b1c93c2f2",
  },
  {
    id: "ordinary-sequence-invisible-final",
    cohort: "value",
    code: "local({observed<-local({result<-withVisible(eval(expression(13L,invisible(23L))));list(value=result$value,visible=result$visible)});identical(observed,list(value=23L,visible=FALSE))})",
    sourceSha256: "8f1efc42f923416c81f86d7522908655296608f35ac85a1d2b9c7a331239068e",
  },
  {
    id: "empty-expression-visible-null",
    cohort: "value",
    code: "local({observed<-local({result<-withVisible(eval(expression()));list(value=result$value,visible=result$visible)});identical(observed,list(value=NULL,visible=TRUE))})",
    sourceSha256: "a275ec8b52bcac9ca5595c1a87e45902908415e4f807b8940fc3072b470ff37e",
  },
  {
    id: "dots-expression-cell-distinction",
    cohort: "diagnostic",
    code: "tryCatch({eval(expression(...));FALSE},error=function(e){if(!identical(conditionMessage(e),\"'...' used in an incorrect context\"))stop(e);TRUE})",
    sourceSha256: "d900f18ebc61211f9974bf19e816772b60d9ecfd9eba31e6f0d218a8b62bceb5",
  },
  {
    id: "missing-cell-unwinds-owned-cleanup",
    cohort: "value",
    code: 'local({observed<-local({events<-character();f<-function(){on.exit(events<<-c(events,"cleanup"));\n    events<<-c(events,"entered");eval(as.expression(list(quote(expr=))))}\n    message<-tryCatch(f(),error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);\n      events<<-c(events,"caught");conditionMessage(e)})\n    recovered<-withVisible(eval(expression(31L)))\n    list(events=events,message=message,value=recovered$value,visible=recovered$visible)});identical(observed,list(events=c("entered","cleanup","caught"),message="argument is missing, with no default",value=31L,visible=TRUE))})',
    sourceSha256: "11d208c97e613b5845f9a1455f1346288681641fecceaad0516566ac30aa5a9a",
  },
  {
    id: "missing-literal-is-ordinary-value",
    cohort: "value",
    code: 'local({observed<-local({result<-withVisible(eval(expression(NA_integer_)));list(value=result$value,type=typeof(result$value),visible=result$visible)});identical(observed,list(value=NA_integer_,type="integer",visible=TRUE))})',
    sourceSha256: "1e92de17d425d9b7ff3e159bdfa046d70229bbfe2278bc0b60328dc95566872d",
  },
];

it.each(cases)("expression evaluation: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
