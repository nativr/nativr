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
// Independently authored GNU R 4.6.1 source-cell fixtures.
// These construct source metadata explicitly; retained parsing and source generation are not claimed.
const cases = [
  {
    id: "integer-cell",
    cohort: "value",
    code: 'local({observed<-local({slot<-c(1L,2L,3L);q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),slot));f<-eval(q);list(length=length(q),slot=q[[4L]],closureAttributes=attributes(f),value=f())});identical(observed,list(length=4L,slot=c(1L,2L,3L),closureAttributes=list(srcref=c(1L,2L,3L)),value=3L))})',
    sourceSha256: "576d359ccc80260232927a9b33fdafe1750250ff2c1d7d66e7e260a30bda0871",
  },
  {
    id: "character-cell",
    cohort: "value",
    code: 'local({observed<-local({slot<-"owned-source";q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),slot));f<-eval(q);list(slot=q[[4L]],closureAttributes=attributes(f),value=f())});identical(observed,list(slot="owned-source",closureAttributes=list(srcref="owned-source"),value=3L))})',
    sourceSha256: "4154f11dea7fa6e2772f32710ed7670677687d42331366d78e3023bbc6f0494d",
  },
  {
    id: "unforced-symbol-cell",
    cohort: "value",
    code: 'local({observed<-local({events<-0L;slot<-as.name("owned_unbound_source_symbol");q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),slot));f<-eval(q);list(same=identical(attr(f,"srcref"),slot),type=typeof(attr(f,"srcref")),events=events,value=f())});identical(observed,list(same=TRUE,type="symbol",events=0L,value=3L))})',
    sourceSha256: "68bb759179f61f5e8a2151eba069d2875a50fd6473a8d744ec665ba548807984",
  },
  {
    id: "unforced-call-cell",
    cohort: "value",
    code: 'local({observed<-local({events<-0L;slot<-quote({events<-events+1L;stop("owned_source_must_not_run")});q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),slot));f<-eval(q);list(same=identical(attr(f,"srcref"),slot),type=typeof(attr(f,"srcref")),events=events,value=f())});identical(observed,list(same=TRUE,type="language",events=0L,value=3L))})',
    sourceSha256: "9271df2e76c9653b57472a450289c9157bc0ffdd8d8ed43a8a4997b962a637ab",
  },
  {
    id: "source-environment-reference",
    cohort: "value",
    code: 'local({observed<-local({owner<-new.env(parent=emptyenv());owner$marker<-7L;slot<-structure(c(1L,1L,3L,1L,1L,1L,1L,3L),class="srcref",srcfile=owner);q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),slot));rebuilt<-as.call(as.list(q));f<-eval(rebuilt);owner$marker<-9L;list(slotValues=as.integer(rebuilt[[4L]]),slotClass=class(rebuilt[[4L]]),callSame=identical(attr(rebuilt[[4L]],"srcfile"),owner),closureSame=identical(attr(attr(f,"srcref"),"srcfile"),owner),marker=attr(attr(f,"srcref"),"srcfile")$marker,value=f())});identical(observed,list(slotValues=c(1L,1L,3L,1L,1L,1L,1L,3L),slotClass="srcref",callSame=TRUE,closureSame=TRUE,marker=9L,value=3L))})',
    sourceSha256: "456bab1ed2896d2b9646f95ac134cbee373978538906a6f8276c6a0c6e996f5f",
  },
  {
    id: "replace-cell-copy",
    cohort: "value",
    code: 'local({observed<-local({q<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),17L));old<-q;q[[4L]]<-29L;f<-eval(q);g<-eval(old);list(oldSlot=old[[4L]],newSlot=q[[4L]],oldClosure=attr(g,"srcref"),newClosure=attr(f,"srcref"),values=c(g(),f()))});identical(observed,list(oldSlot=17L,newSlot=29L,oldClosure=17L,newClosure=29L,values=c(3L,3L)))})',
    sourceSha256: "191e68c4b62ca20701c440c603e2dd3b54fdc51857093b8cfa8cb248db44b363",
  },
  {
    id: "delete-cell-independent-body",
    cohort: "value",
    code: 'local({observed<-local({owner<-new.env(parent=emptyenv());owner$marker<-7L;b<-quote(x+2L);attr(b,"owner")<-owner;q<-as.call(list(as.name("function"),pairlist(x=1L),b,17L));attr(q,"note")<-"owned";old<-q;q[[4L]]<-NULL;f<-eval(q);list(lengths=c(length(old),length(q)),outer=attributes(q),closure=attributes(f),bodySame=identical(attr(body(f),"owner"),owner),value=f())});identical(observed,list(lengths=c(4L,3L),outer=list(note="owned"),closure=NULL,bodySame=TRUE,value=3L))})',
    sourceSha256: "3d6e210fb98a54a26f94d8ee2b2eedaad262beecc1ccafad4c9be483f53fc5cb",
  },
  {
    id: "source-cell-equality",
    cohort: "value",
    code: 'local({observed<-local({a<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),17L));b<-as.call(list(as.name("function"),pairlist(x=1L),quote(x+2L),29L));f<-eval(a);g<-eval(b);list(callDefault=identical(a,b),callStrict=identical(a,b,ignore.srcref=FALSE),closureDefault=identical(f,g),closureStrict=identical(f,g,ignore.srcref=FALSE))});identical(observed,list(callDefault=FALSE,callStrict=FALSE,closureDefault=TRUE,closureStrict=FALSE))})',
    sourceSha256: "c2b6ed8dfbb1c83d3a1454a66adbe5e15ff41ce43aa82bc068c01f205534a484",
  },
];

it.each(cases)("function source cell: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
