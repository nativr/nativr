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
// Independently authored GNU R 4.6.1 assertions frozen before implementation.
// Diagnostic controls assert messages only and rethrow every unexpected error.
const cases = [
  {
    id: "direct-quote",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-quote(...);list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "aec5a844f49e102a6a6f18f3ee58ae911aa9ef43cc822a5123f8a6c383048f0c",
  },
  {
    id: "call-double-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-quote(owned(...))[[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "b0740edf09cf433b4268ec106d0220435f35133333873fe9d223b682d0bc8ce3",
  },
  {
    id: "call-list-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-as.list(quote(owned(...)))[[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "44b4c9784c02b4d591ac20b645da4c48582906ba5a86963ca2da011f602ce8f5",
  },
  {
    id: "nested-call-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-quote(outer(inner(...)))[[2L]][[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "fccbcdc7ed444b9ccd59880027322d326ea33529fdbd8b639636757f7b862d50",
  },
  {
    id: "call-single-subset-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-quote(owned(...))[2L][[1L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "5f6c29e47da56d0e1c8b65aa4b4d2ad9b49d5a15f5d39e38f8048ed2c970a6f7",
  },
  {
    id: "expression-double-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-expression(...)[[1L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "f5065eb6532710a1261c753e1ddd723bfb45943d3f94f5fb66349d4ab1c4f062",
  },
  {
    id: "expression-list-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-as.list(expression(...))[[1L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "f917e8684340e60f7d884fa48422f1707e954d0b1692d5b4c0ca0d1c8d54fe94",
  },
  {
    id: "expression-single-subset-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-expression(...)[1L][[1L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "563f7d8431c7f4db60b2b339999a5338972aeacd5b9133ddb61c1b13ca3e5003",
  },
  {
    id: "call-list-expression-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-as.expression(as.list(quote(owned(...))))[[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "31feea187c415c9e346b502d9c935d33f3998d98d955191d9a3480a41c1226cb",
  },
  {
    id: "symbol-expression-extraction",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-as.expression(list(as.name("...")))[[1L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "55a28fead9a72067a6d04a1437086128a90c91119f965652c943466f2f512ff5",
  },
  {
    id: "call-roundtrip",
    cohort: "quoted-dots",
    code: 'local({observed<-local({q<-quote(owned(...));rebuilt<-as.call(as.list(q));list(same=identical(q,rebuilt),type=typeof(rebuilt[[2L]]),symbol=identical(rebuilt[[2L]],as.name("...")),names=names(rebuilt),length=length(rebuilt))});identical(observed,list(same=TRUE,type="symbol",symbol=TRUE,names=NULL,length=2L))})',
    sourceSha256: "2cfa255e338a6ee33112b20c2ff45675af06e7c7dc6bd1dc3e6197a7ecd94f27",
  },
  {
    id: "replacement-evaluation",
    cohort: "quoted-dots",
    code: 'local({observed<-local({q<-quote(owned(...));q[[2L]]<-q[[2L]];owned<-function(...)list(...);f<-function(...)eval(q);list(type=typeof(q[[2L]]),symbol=identical(q[[2L]],as.name("...")),value=f(11L,22L))});identical(observed,list(type="symbol",symbol=TRUE,value=list(11L,22L)))})',
    sourceSha256: "8fb22aa8fecf917ec745d6387cd52420ba43ad93504ec1d71e3c0835d22466a4",
  },
  {
    id: "substitute-empty-list",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-substitute(owned(...),list())[[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "bddb33b7a4c13c6ace998aeb7ddac041f3cee49b9318cc06d891ed96c806ec63",
  },
  {
    id: "substitute-direct",
    cohort: "quoted-dots",
    code: 'local({observed<-local({x<-substitute(owned(...))[[2L]];list(type=typeof(x),name=as.character(x),same=identical(x,as.name("...")),attributes=attributes(x))});identical(observed,list(type="symbol",name="...",same=TRUE,attributes=NULL))})',
    sourceSha256: "bc9be849c3d3f61d5b07c139b1a9de4b4f2a50f30d6dbe8445b0cc2b4dc81825",
  },
  {
    id: "missing-versus-dots",
    cohort: "quoted-dots",
    code: 'local({observed<-local({q<-quote(owned(,...));list(types=c(typeof(q[[2L]]),typeof(q[[3L]])),missingName=as.character(q[[2L]]),dotsName=as.character(q[[3L]]),different=identical(q[[2L]],q[[3L]]),missingSame=identical(q[[2L]],quote(expr=)),dotsSame=identical(q[[3L]],quote(...)),tags=names(q))});identical(observed,list(types=c("symbol","symbol"),missingName="",dotsName="...",different=FALSE,missingSame=TRUE,dotsSame=TRUE,tags=NULL))})',
    sourceSha256: "bc71d239fc7fac87eac9c339a9de4d91b7f479f14a097f5725b95a639797c721",
  },
  {
    id: "dots-versus-dotdot-one",
    cohort: "quoted-dots",
    code: 'local({observed<-local({q<-quote(owned(...,..1));list(types=c(typeof(q[[2L]]),typeof(q[[3L]])),names=c(as.character(q[[2L]]),as.character(q[[3L]])),different=identical(q[[2L]],q[[3L]]))});identical(observed,list(types=c("symbol","symbol"),names=c("...","..1"),different=FALSE))})',
    sourceSha256: "5b4fa19e539f76ca92c4a0aaf2772967e0a0c5b335c91f26078c3869df40c94e",
  },
  {
    id: "missing-evaluation-diagnostic",
    cohort: "diagnostic",
    code: 'tryCatch({eval(quote(owned(,...))[[2L]]);FALSE},error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);TRUE})',
    sourceSha256: "8119cad1acaa32bc88e9bea3417212d60fbcc43c6f9cd6caa1a5f4529c01bc03",
  },
  {
    id: "dots-evaluation-diagnostic",
    cohort: "diagnostic",
    code: "tryCatch({eval(quote(owned(...))[[2L]]);FALSE},error=function(e){if(!identical(conditionMessage(e),\"'...' used in an incorrect context\"))stop(e);TRUE})",
    sourceSha256: "2d59975a62b74e4387dcb2b5844bec8c1549e49418cac58bedb7243f3d2b0cb9",
  },
  {
    id: "quoted-dots-leaves-actual-lazy",
    cohort: "quoted-dots",
    code: 'local({observed<-local({f<-function(...)list(type=typeof(quote(owned(...))[[2L]]),same=identical(quote(owned(...))[[2L]],as.name("...")));f(stop("owned actual forced"))});identical(observed,list(type="symbol",same=TRUE))})',
    sourceSha256: "389c64a3ed381205a4bb29086c3ac7d28c796e1e8c4da6781c005e472386cd5f",
  },
  {
    id: "expression-identity-roundtrip",
    cohort: "quoted-dots",
    code: 'local({observed<-local({a<-expression(...);b<-as.expression(list(as.name("...")));list(same=identical(a,b),cellSame=identical(a[[1L]],b[[1L]]),leftType=typeof(a[[1L]]),rightType=typeof(b[[1L]]))});identical(observed,list(same=TRUE,cellSame=TRUE,leftType="symbol",rightType="symbol"))})',
    sourceSha256: "fe2b2b043c3f9123ded19590c58760c42371afa7b7ee34ce8992f3d7aef062c4",
  },
];

it.each(cases)("quoted dots: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
