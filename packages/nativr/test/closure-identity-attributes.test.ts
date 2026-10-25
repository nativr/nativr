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
// Separate independently authored closure-attribute adjunct; not added to the eight-case baseline.
const cases = [
  {
    id: "ordinary-closure-note",
    cohort: "value",
    code: 'local({observed<-local({f<-function(x=2L)x+3L;g<-f;attr(f,"note")<-17L;attr(g,"note")<-29L;different<-c(default=identical(f,g),ignore=identical(f,g,ignore.srcref=TRUE),strict=identical(f,g,ignore.srcref=FALSE));attr(g,"note")<-17L;list(different=different,equal=c(default=identical(f,g),strict=identical(f,g,ignore.srcref=FALSE)))});identical(observed,list(different=c(default=FALSE,ignore=FALSE,strict=FALSE),equal=c(default=TRUE,strict=TRUE)))})',
    sourceSha256: "a5e41770e4bc7a04ffbb94e2a942ae10acb738acd20133d6b24ce005a531a6bd",
  },
  {
    id: "closure-srcref-switch",
    cohort: "value",
    code: 'local({observed<-local({f<-function(x=2L)x+3L;g<-f;attr(f,"srcref")<-17L;attr(g,"srcref")<-29L;different<-c(default=identical(f,g),ignore=identical(f,g,ignore.srcref=TRUE),strict=identical(f,g,ignore.srcref=FALSE));attr(g,"srcref")<-17L;same<-identical(f,g,ignore.srcref=FALSE);attr(g,"srcref")<-NULL;list(different=different,same=same,removed=c(default=identical(f,g),strict=identical(f,g,ignore.srcref=FALSE)))});identical(observed,list(different=c(default=TRUE,ignore=TRUE,strict=FALSE),same=TRUE,removed=c(default=TRUE,strict=FALSE)))})',
    sourceSha256: "606b4c1a9516f0479055bb13e67be19c35037eb5a5158588e9e49a839f0b13b8",
  },
  {
    id: "closure-other-source-names",
    cohort: "value",
    code: 'local({observed<-local({observe<-function(name){f<-function(x=2L)x+3L;g<-f;attr(f,name)<-17L;attr(g,name)<-29L;c(default=identical(f,g),ignore=identical(f,g,ignore.srcref=TRUE),strict=identical(f,g,ignore.srcref=FALSE))};list(srcfile=observe("srcfile"),wholeSrcref=observe("wholeSrcref"))});identical(observed,list(srcfile=c(default=FALSE,ignore=FALSE,strict=FALSE),wholeSrcref=c(default=FALSE,ignore=FALSE,strict=FALSE)))})',
    sourceSha256: "72c5777f242152c0b892c3572eb0a3d9d7515990e911073fdb6ab727afb3142d",
  },
];

it.each(cases)("closure source attributes: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
