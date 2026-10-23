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
// Separate independently authored GNU R 4.6.1 adjunct. The original quoted-dots twenty remain unchanged.
// Exact diagnostics rethrow unexpected errors; condition classes and call-origin identity are unclaimed.
const cases = [
  {
    id: "explicit-missing",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(expr=)),name=as.character(quote(expr=)),same=identical(quote(expr=),formals(function(x)NULL)[[1L]]));identical(observed,list(type="symbol",name="",same=TRUE))})',
    sourceSha256: "ebf1e610b90803915b43a6fba725624e5096bc7e2ab506649c0df2fbbe67ddd9",
  },
  {
    id: "absent-argument",
    cohort: "diagnostic",
    code: "tryCatch({quote();FALSE},error=function(e){if(!identical(conditionMessage(e),\"0 arguments passed to 'quote' which requires 1\"))stop(e);TRUE})",
    sourceSha256: "f4d422a6f7d795a2f821665bb007ee4db0607f164d5a97fe8581cf7c4963cfa2",
  },
  {
    id: "two-missing-arguments",
    cohort: "diagnostic",
    code: "tryCatch({quote(,);FALSE},error=function(e){if(!identical(conditionMessage(e),\"2 arguments passed to 'quote' which requires 1\"))stop(e);TRUE})",
    sourceSha256: "02820a1a5c3f816fb7c3859e3f4f0afb62c2b9842a8d987cb35b390e6524fec9",
  },
  {
    id: "extra-named-argument",
    cohort: "diagnostic",
    code: "tryCatch({quote(expr=,other=1L);FALSE},error=function(e){if(!identical(conditionMessage(e),\"2 arguments passed to 'quote' which requires 1\"))stop(e);TRUE})",
    sourceSha256: "ff651610d762e341d6ebe032a9a93e903f0210b3705aace70f5dbb6377bfecd7",
  },
  {
    id: "named-present",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(expr=17L)),value=quote(expr=17L));identical(observed,list(type="integer",value=17L))})',
    sourceSha256: "ebc613bed4777895b110e8b2c9cac51b7e284113bb19e32c299e6de458cefbfc",
  },
  {
    id: "partial-named-present",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(e=17L)),value=quote(e=17L));identical(observed,list(type="integer",value=17L))})',
    sourceSha256: "7a772ca0a4555125aa4ab7b707acba6b6c8af70f3206899c3651e4b235303968",
  },
  {
    id: "other-named-present",
    cohort: "diagnostic",
    code: "tryCatch({list(type=typeof(quote(owned=17L)),value=quote(owned=17L));FALSE},error=function(e){if(!identical(conditionMessage(e),\"supplied argument name 'owned' does not match 'expr'\"))stop(e);TRUE})",
    sourceSha256: "26ca3c5c2119bd83ef2e25e4c9dbcae191f96e1d25936a0d10ada5b4fab2ff6a",
  },
  {
    id: "named-lazy-expression",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(expr=stop("owned forced"))),same=identical(quote(expr=stop("owned forced")),quote(stop("owned forced"))));identical(observed,list(type="language",same=TRUE))})',
    sourceSha256: "a36020f47c60e711a860847d173771d96e44e64d7c27b073b65ea13b821b4ab1",
  },
  {
    id: "positional-lazy-expression",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(stop("owned forced"))),same=identical(quote(stop("owned forced")),as.call(list(as.name("stop"),"owned forced"))));identical(observed,list(type="language",same=TRUE))})',
    sourceSha256: "d8a09f60c990f9399c5e74903b8a81da5184cc23d17fe8cb7be9e3444bf07266",
  },
  {
    id: "explicit-null",
    cohort: "value",
    code: 'local({observed<-list(type=typeof(quote(expr=NULL)),value=quote(expr=NULL));identical(observed,list(type="NULL",value=NULL))})',
    sourceSha256: "5f7af046501fd2e07e020b519f004ad1fc7f52ccd8d62356d70c4c755c4329e4",
  },
  {
    id: "forwarded-missing-syntax",
    cohort: "value",
    code: 'local({observed<-local({f<-function(x)quote(expr=x);list(type=typeof(f()),same=identical(f(),as.name("x")))});identical(observed,list(type="symbol",same=TRUE))})',
    sourceSha256: "9edab7641509ada5ae35254cf9cc671fb8f0fd2702828ed06cace20e0c10001c",
  },
  {
    id: "other-named-missing",
    cohort: "diagnostic",
    code: "tryCatch({list(type=typeof(quote(owned=)),name=as.character(quote(owned=)));FALSE},error=function(e){if(!identical(conditionMessage(e),\"supplied argument name 'owned' does not match 'expr'\"))stop(e);TRUE})",
    sourceSha256: "5b52d89e68d76d1944286c926ad61008b3d6690d085c74afd6ca85c494beab9e",
  },
  {
    id: "eval-explicit-missing",
    cohort: "diagnostic",
    code: 'tryCatch({eval(quote(expr=));FALSE},error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "d20f74e350ccd6dd503db924a6c0e82b66b36b3960f9f14ec1a34e23dfdb1576",
  },
  {
    id: "eval-list-missing",
    cohort: "diagnostic",
    code: 'tryCatch({eval(as.list(quote(owned(,)))[[2L]]);FALSE},error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "e6585531952955aaf0713b9a4829999add0e566aafd02668435f4d8b8671b137",
  },
  {
    id: "force-named-missing",
    cohort: "diagnostic",
    code: 'tryCatch({local({f<-function(x)x;f()});FALSE},error=function(e){if(!identical(conditionMessage(e),"argument \\"x\\" is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "218783628e97b4d9f3eeecd27e789c61c2f6c82a6923a076a8deda76c77cdf4f",
  },
  {
    id: "eval-direct-dots",
    cohort: "diagnostic",
    code: "tryCatch({eval(quote(...));FALSE},error=function(e){if(!identical(conditionMessage(e),\"'...' used in an incorrect context\"))stop(e);TRUE})",
    sourceSha256: "2fd20b576bea3cac224c42e7223aef72c8ee7bbf7e8a80bb3e100b511d1e0767",
  },
];

it.each(cases)("quoted missing adjunct: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
