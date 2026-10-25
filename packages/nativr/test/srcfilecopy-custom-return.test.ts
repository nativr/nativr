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
// Independently authored GNU R 4.6.1 source-file normalization prerequisites.
// Actual retained parsing and parseData generation remain separate unfinished work.
const cases = [
  {
    id: "no-lf-preserves-custom-attributes",
    cohort: "srcfilecopy-custom-return-adjunct",
    code: 'local({owner<-new.env(parent=emptyenv());owner$marker<-17L;returned<-structure(c(first="one",second="two"),note="owned",class="owned_return",owner=owner);assign("as.character.owned_lines",function(x,...)returned,envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));sf<-srcfilecopy("owned.R",structure("plain",class="owned_lines"),timestamp=0,isFile=FALSE);owner$marker<-29L;identical(sf$lines,returned)&&identical(names(sf$lines),c("first","second"))&&identical(attr(sf$lines,"note"),"owned")&&identical(class(sf$lines),"owned_return")&&identical(attr(sf$lines,"owner"),owner)&&identical(attr(sf$lines,"owner")$marker,29L)&&identical(sf$fixedNewlines,TRUE)})',
    sourceSha256: "2dbcfd53ea79f83f7e993edb78639062d75cc3bd79db3b215c2ed44f9a1c6569",
  },
  {
    id: "no-lf-preserves-custom-noncharacter",
    cohort: "srcfilecopy-custom-return-adjunct",
    code: 'local({assign("as.character.owned_lines",function(x,...)structure(17L,note="owned"),envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));a<-srcfilecopy("owned.R",structure("plain",class="owned_lines"),timestamp=0,isFile=FALSE);assign("as.character.owned_lines",function(x,...)NULL,envir=.GlobalEnv);b<-srcfilecopy("owned.R",structure("plain",class="owned_lines"),timestamp=0,isFile=FALSE);events<-0L;assign("as.character.owned_lines",function(x,...){events<<-events+1L;if(events==1L)"plain"else 29L},envir=.GlobalEnv);d<-srcfilecopy("owned.R",structure(17L,class="owned_lines"),timestamp=0,isFile=FALSE);identical(a$lines,structure(17L,note="owned"))&&is.null(b$lines)&&identical(d$lines,29L)&&identical(events,2L)&&identical(a$fixedNewlines,TRUE)&&identical(b$fixedNewlines,TRUE)})',
    sourceSha256: "d83ec9c516c67113850537bba9a8098da0f4dd584ef6718f05e615759a6cb30e",
  },
  {
    id: "lf-recoercion-custom-return",
    cohort: "srcfilecopy-custom-return-adjunct",
    code: 'local({events<-character();assign("as.character.owned_lines",function(x,...){events<<-c(events,"source");structure(17L,note="owned",class="owned_return")},envir=.GlobalEnv);assign("as.character.owned_return",function(x,...){events<<-c(events,"return");"recoerced\\nvalue"},envir=.GlobalEnv);on.exit(rm(list=c("as.character.owned_lines","as.character.owned_return"),envir=.GlobalEnv));a<-srcfilecopy("owned.R",structure("raw\\nvalue",class="owned_lines"),timestamp=0,isFile=FALSE);firstEvents<-events;events<-character();assign("as.character.owned_lines",function(x,...){events<<-c(events,"source");structure("original\\nreturn",note="owned",class="owned_return")},envir=.GlobalEnv);b<-srcfilecopy("owned.R",structure("raw\\nvalue",class="owned_lines"),timestamp=0,isFile=FALSE);identical(a$lines,c("recoerced","value"))&&identical(firstEvents,c("source","return"))&&identical(b$lines,c("original","return"))&&identical(events,"source")&&is.null(attributes(a$lines))&&is.null(attributes(b$lines))})',
    sourceSha256: "c40462f22efa78ef33c1b10ab1313b3d35968e0b09ff8e8e4c1dbf99f22148e6",
  },
];

it.each(cases)("srcfilecopy custom return: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.visible).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
