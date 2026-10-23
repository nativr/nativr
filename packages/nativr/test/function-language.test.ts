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
// Independent GNU R 4.6.1 assertions frozen before implementation. Retained source slots are excluded.
const cases = [
  {
    id: "function-call-cells",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L){x+2L});cells<-as.list(q);list(type=typeof(q),length=length(q),names=names(q),attributes=attributes(q),cells=cells,cellTypes=vapply(cells,typeof,character(1)),formalNames=names(q[[2L]]),body=q[[3L]])});identical(observed$type,"language")&&identical(observed$length,4L)&&is.null(observed$names)&&is.null(observed$attributes)&&identical(observed$cellTypes,c("symbol","pairlist","language","NULL"))&&identical(observed$formalNames,"x")&&length(observed$cells)==4L&&is.null(names(observed$cells))&&identical(observed$cells[[1L]],as.name("function"))&&identical(observed$cells[[2L]],pairlist(x=1L))&&identical(observed$cells[[3L]],quote({x+2L}))&&is.null(observed$cells[[4L]])&&identical(observed$body,quote({x+2L}))})',
    sourceSha256: "cfea7190077c832e470a3e633ccaacd9c7971367b4cf750000b2a778746f6fd9",
  },
  {
    id: "function-empty-formals",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function()17L);list(length=length(q),cells=as.list(q),formalType=typeof(q[[2L]]),value=eval(q)())});identical(observed$length,4L)&&identical(observed$formalType,"NULL")&&identical(observed$value,17L)&&length(observed$cells)==4L&&is.null(names(observed$cells))&&identical(observed$cells[[1L]],as.name("function"))&&is.null(observed$cells[[2L]])&&identical(observed$cells[[3L]],17L)&&is.null(observed$cells[[4L]])})',
    sourceSha256: "5524606d59fbe2e2e6caace2a7f925b8facce97acb86ad4625f594a22b7cea4a",
  },
  {
    id: "function-missing-and-dots-formals",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x,...,y=2L)list(missing(x),y,length(list(...))));list(cells=as.list(q),formalNames=names(q[[2L]]),value=eval(q)(y=7L))});length(observed$cells)==4L&&is.null(names(observed$cells))&&identical(observed$cells[[1L]],as.name("function"))&&identical(typeof(observed$cells[[2L]]),"pairlist")&&identical(observed$formalNames,c("x","...","y"))&&identical(observed$cells[[2L]],formals(function(x,...,y=2L)NULL))&&identical(observed$cells[[3L]],quote(list(missing(x),y,length(list(...)))))&&is.null(observed$cells[[4L]])&&identical(observed$value,list(TRUE,7L,0L))})',
    sourceSha256: "1af1d6b6b3f2b248efc4245fa216b6e5265afa1f11867513b1941c1c73a13d3e",
  },
  {
    id: "function-call-roundtrip",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L){x+2L});rebuilt<-as.call(as.list(q));f<-eval(rebuilt);list(identical=identical(q,rebuilt),cells=as.list(rebuilt),formals=formals(f),body=body(f),value=f(),environmentSame=identical(environment(f),environment()))});identical(observed$identical,TRUE)&&length(observed$cells)==4L&&is.null(names(observed$cells))&&identical(observed$cells[[1L]],as.name("function"))&&identical(observed$cells[[2L]],pairlist(x=1L))&&identical(observed$cells[[3L]],quote({x+2L}))&&is.null(observed$cells[[4L]])&&identical(observed$formals,pairlist(x=1L))&&identical(observed$body,quote({x+2L}))&&identical(observed$value,3L)&&identical(observed$environmentSame,TRUE)})',
    sourceSha256: "2e7c3e96f36adbf91ee0954ae9d1aa45c28565463cfd2fe931c70de67f24eb23",
  },
  {
    id: "function-formals-replacement",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L)x+2L);before<-q;q[[2L]]<-pairlist(x=3L);f<-eval(q);list(original=as.list(before),changed=as.list(q),formals=formals(f),value=f(),originalValue=eval(before)())});length(observed$original)==4L&&length(observed$changed)==4L&&is.null(names(observed$original))&&is.null(names(observed$changed))&&identical(observed$original[[1L]],as.name("function"))&&identical(observed$changed[[1L]],as.name("function"))&&identical(observed$original[[2L]],pairlist(x=1L))&&identical(observed$changed[[2L]],pairlist(x=3L))&&identical(observed$original[[3L]],quote(x+2L))&&identical(observed$changed[[3L]],quote(x+2L))&&is.null(observed$original[[4L]])&&is.null(observed$changed[[4L]])&&identical(observed$formals,pairlist(x=3L))&&identical(observed$value,5L)&&identical(observed$originalValue,3L)})',
    sourceSha256: "8d9d155acd0cbc5d5acceb839fcd1506a2c6caeb8f3f3153a6ed2467134c9e26",
  },
  {
    id: "function-body-replacement",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L)x+2L);before<-q;q[[3L]]<-quote(x+4L);f<-eval(q);list(original=as.list(before),changed=as.list(q),body=body(f),value=f(),originalValue=eval(before)())});length(observed$original)==4L&&length(observed$changed)==4L&&is.null(names(observed$original))&&is.null(names(observed$changed))&&identical(observed$original[[1L]],as.name("function"))&&identical(observed$changed[[1L]],as.name("function"))&&identical(observed$original[[2L]],pairlist(x=1L))&&identical(observed$changed[[2L]],pairlist(x=1L))&&identical(observed$original[[3L]],quote(x+2L))&&identical(observed$changed[[3L]],quote(x+4L))&&is.null(observed$original[[4L]])&&is.null(observed$changed[[4L]])&&identical(observed$body,quote(x+4L))&&identical(observed$value,5L)&&identical(observed$originalValue,3L)})',
    sourceSha256: "8f54e3fe5b917d9727d13213c9fe2e2613c3de3c43fa3506cb3f0d8381252d0b",
  },
  {
    id: "function-default-laziness",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));events<-character();q<-quote(function(x={events<<-c(events,"default");5L})x);cells<-as.list(q);rebuilt<-as.call(cells);f<-eval(rebuilt);before<-events;value<-f();list(before=before,value=value,after=events,formalNames=names(formals(f)))});identical(observed$before,character())&&identical(observed$value,5L)&&identical(observed$after,"default")&&identical(observed$formalNames,"x")})',
    sourceSha256: "9acee09a9c3deb1ad2cb212af1ee7f851b533c99f0bcebbbf94c2e1267c0e91d",
  },
  {
    id: "function-attributed-body-reference",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));owner<-new.env(parent=emptyenv());owner$marker<-11L;b<-quote(x+2L);attr(b,"owner")<-owner;q<-quote(function(x=1L)x);q[[3L]]<-b;rebuilt<-as.call(as.list(q));f<-eval(rebuilt);owner$marker<-13L;list(value=f(),body=body(f),sameInput=identical(attr(q[[3L]],"owner"),owner),sameRoundtrip=identical(attr(rebuilt[[3L]],"owner"),owner),sameClosure=identical(attr(body(f),"owner"),owner),marker=attr(body(f),"owner")$marker)});identical(observed$value,3L)&&identical(typeof(observed$body),"language")&&identical(names(attributes(observed$body)),"owner")&&identical(attr(observed$body,"owner")$marker,13L)&&identical(observed$sameInput,TRUE)&&identical(observed$sameRoundtrip,TRUE)&&identical(observed$sameClosure,TRUE)&&identical(observed$marker,13L)})',
    sourceSha256: "04ae315d7cd2d7553a302c162b4661e913ee225fa95c2c56d20dd834bf3a36cd",
  },
  {
    id: "function-ordinary-attributes",
    code: 'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L)x+2L);attr(q,"note")<-"owned";cells<-as.list(q);rebuilt<-as.call(cells);f<-eval(q);list(callAttributes=attributes(q),listAttributes=attributes(cells),rebuiltAttributes=attributes(rebuilt),functionAttributes=attributes(f),value=f())});identical(observed$callAttributes,list(note="owned"))&&identical(observed$listAttributes,list(note="owned"))&&is.null(observed$rebuiltAttributes)&&is.null(observed$functionAttributes)&&identical(observed$value,3L)})',
    sourceSha256: "fcb378571be3cabc6e031770dfd5cd054466a0918c1eca1a6fba03658909b4d3",
  },
];
it.each(cases)("function language: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});

// Separately observed plain three-cell construction, deletion, and structural identity.
const adjunctCases = [
  {
    id: "plain-fourth-null-deletion",
    code: 'local({observed<-local({q<-quote(function(x=1L)x+2L);attr(q,"note")<-"owned";before<-q;q[[4L]]<-NULL;f<-eval(q);list(originalLength=length(before),length=length(q),originalNull=is.null(before[[4L]]),attributes=attributes(q),formals=formals(f),body=body(f),value=f(),closureAttributes=attributes(f))});identical(observed$originalLength,4L)&&identical(observed$length,3L)&&identical(observed$originalNull,TRUE)&&identical(observed$attributes,list(note="owned"))&&identical(observed$formals,pairlist(x=1L))&&identical(observed$body,quote(x+2L))&&identical(observed$value,3L)&&is.null(observed$closureAttributes)})',
    sourceSha256: "7eb8cb13f0c9abceaee104400cbc6b989686e78acb43394aa792e7887f179a54",
  },
  {
    id: "plain-three-cell-construction",
    code: 'local({observed<-local({owner<-new.env(parent=emptyenv());owner$marker<-7L;b<-quote(x+2L);attr(b,"owner")<-owner;q<-as.call(list(as.name("function"),pairlist(x=1L),b));f<-eval(q);owner$marker<-9L;list(length=length(q),names=names(q),attributes=attributes(q),formalType=typeof(q[[2L]]),formals=formals(f),value=f(),bodySame=identical(attr(q[[3L]],"owner"),owner),closureBodySame=identical(attr(body(f),"owner"),owner),marker=attr(body(f),"owner")$marker)});identical(observed$length,3L)&&is.null(observed$names)&&is.null(observed$attributes)&&identical(observed$formalType,"pairlist")&&identical(observed$formals,pairlist(x=1L))&&identical(observed$value,3L)&&identical(observed$bodySame,TRUE)&&identical(observed$closureBodySame,TRUE)&&identical(observed$marker,9L)})',
    sourceSha256: "165ed2dc063ccdd57f23636bf65ce34f31cfbd019a31021b448c9e1b4a2e7355",
  },
  {
    id: "plain-three-four-cell-identity",
    code: 'local({observed<-local({a<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L)));b<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),NULL));list(lengths=c(length(a),length(b)),defaultIdentical=identical(a,b),strictIdentical=identical(a,b,ignore.srcref=FALSE),fourthNull=is.null(b[[4L]]),values=c(eval(a)(),eval(b)()))});identical(observed$lengths,c(3L,4L))&&identical(observed$defaultIdentical,FALSE)&&identical(observed$strictIdentical,FALSE)&&identical(observed$fourthNull,TRUE)&&identical(observed$values,c(3L,3L))})',
    sourceSha256: "795de653f4165f1a7a29da31c648189c6187468929336529458944bda3c3804a",
  },
];
it.each(adjunctCases)("function language plain-shape adjunct: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});

// NativR-only allocation boundary and same-session recovery, with no native resource credit.
it("bounds formal materialization and recovers without forcing defaults", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 32 } });
  try {
    const parameters = Array.from(
      { length: 40 },
      (_, index) => `x${index}=stop("owned default forced")`,
    ).join(",");
    await r.eval(`wide<-quote(function(${parameters})23L);NULL`);
    await expect(r.eval("as.list(wide)")).rejects.toMatchObject({ code: "NRL4002" });
    expect(
      await r.eval(
        "length(wide)==4L&&is.null(names(wide))&&is.null(attributes(wide))&&sys.nframe()==0L",
      ),
    ).toBe(true);
    expect(await r.eval("eval(wide)()")).toBe(23);
    expect(await r.eval('eval(as.call(as.list(quote(function(x=stop("unused"))29L))))()')).toBe(29);
  } finally {
    await r.dispose();
  }
});
