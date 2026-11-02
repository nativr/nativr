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
// Independently authored and native-verified before the clean 0.402 baseline.
// These unchanged cases are a bounded matrix, not evidence of complete parser equivalence.
const cases = [
  {
    id: "syntax-error-existing-true",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=TRUE);on.exit(options(old));text<-c("17L", "29L +");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);sf$parseData<-71L;caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=list(classes=c("simpleError","error","condition"),message="owned.R:3:0: unexpected end of input\\n1: 17L\\n2: 29L +\\n  ^"),valueLength=0L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=c(1L,1L,1L,3L,1L,261L,1L,2L,1L,1L,1L,3L,0L,79L,2L,0L,2L,1L,2L,3L,1L,261L,6L,7L,2L,1L,2L,3L,0L,79L,7L,0L,2L,5L,2L,5L,1L,43L,8L,0L),dim=c(8L,5L),tokens=c("NUM_CONST","expr","NUM_CONST","expr","\'+\'"),text=c("17L","","29L","","+"),class="parseData"))})',
    sourceSha256: "68064b0db1490d3bf99151290288790934d0e8d012868fc111e0a4f82f909367",
  },
  {
    id: "syntax-error-existing-false",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=FALSE);on.exit(options(old));text<-c("17L", "29L +");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);sf$parseData<-71L;caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=list(classes=c("simpleError","error","condition"),message="owned.R:3:0: unexpected end of input\\n1: 17L\\n2: 29L +\\n  ^"),valueLength=0L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=71L,dim=NULL,tokens=NULL,text=NULL,class="integer"))})',
    sourceSha256: "d15d8c4b3426cdfc484ab1eb9f36c8026d46f5a5538e08e36ba0aeec29f7b956",
  },
  {
    id: "syntax-error-absent-true",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=TRUE);on.exit(options(old));text<-c("17L", "29L +");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=list(classes=c("simpleError","error","condition"),message="owned.R:3:0: unexpected end of input\\n1: 17L\\n2: 29L +\\n  ^"),valueLength=0L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=c(1L,1L,1L,3L,1L,261L,1L,2L,1L,1L,1L,3L,0L,79L,2L,0L,2L,1L,2L,3L,1L,261L,6L,7L,2L,1L,2L,3L,0L,79L,7L,0L,2L,5L,2L,5L,1L,43L,8L,0L),dim=c(8L,5L),tokens=c("NUM_CONST","expr","NUM_CONST","expr","\'+\'"),text=c("17L","","29L","","+"),class="parseData"))})',
    sourceSha256: "dbff789dce5ffb9d4fcbf80c01a2e26a29c76dec57bc01d058288e96bb9c0af2",
  },
  {
    id: "syntax-error-unexpected-true",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=TRUE);on.exit(options(old));text<-c("17L", "29L )");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);sf$parseData<-71L;caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=list(classes=c("simpleError","error","condition"),message="owned.R:2:5: unexpected \')\'\\n1: 17L\\n2: 29L )\\n       ^"),valueLength=0L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=c(1L,1L,1L,3L,1L,261L,1L,2L,1L,1L,1L,3L,0L,79L,2L,0L,2L,1L,2L,3L,1L,261L,6L,7L,2L,1L,2L,3L,0L,79L,7L,0L,2L,5L,2L,5L,1L,41L,8L,0L),dim=c(8L,5L),tokens=c("NUM_CONST","expr","NUM_CONST","expr","\')\'"),text=c("17L","","29L","",")"),class="parseData"))})',
    sourceSha256: "2497421bde6b5670a65e9aa98d21f2a0c05f938787ab8c1c76e21b16380caddd",
  },
  {
    id: "finite-n-existing-true",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=TRUE);on.exit(options(old));text<-c("17L", "29L +");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);sf$parseData<-71L;caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf,n=1L),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=NULL,valueLength=1L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=c(1L,1L,1L,3L,1L,261L,1L,2L,1L,1L,1L,3L,0L,79L,2L,0L),dim=c(8L,2L),tokens=c("NUM_CONST","expr"),text=c("17L",""),class="parseData"))})',
    sourceSha256: "c582419fb9f57f5e061c2202b02cd09226ac6b394965da02c5e6fd11550f9e10",
  },
  {
    id: "finite-n-existing-false",
    code: 'local({observed<-local({old<-options(keep.source=FALSE,keep.parse.data=FALSE);on.exit(options(old));text<-c("17L", "29L +");sf<-srcfilecopy("owned.R",c("caller owned lines"),timestamp=0,isFile=FALSE);sf$parseData<-71L;caught<-NULL;p<-tryCatch(parse(text=text,keep.source=TRUE,srcfile=sf,n=1L),error=function(e){caught<<-list(classes=class(e),message=conditionMessage(e));NULL});pd<-sf$parseData;list(error=caught,valueLength=length(p),sourceLines=sf$lines,parseDataPresent=exists("parseData",sf,inherits=FALSE),parseDataType=typeof(pd),matrix=as.integer(pd),dim=dim(pd),tokens=attr(pd,"tokens"),text=attr(pd,"text"),class=class(pd))});identical(observed,list(error=NULL,valueLength=1L,sourceLines="caller owned lines",parseDataPresent=TRUE,parseDataType="integer",matrix=71L,dim=NULL,tokens=NULL,text=NULL,class="integer"))})',
    sourceSha256: "f7cbbb729e409bf223a09333ddc70a76e2a4031b570c25ac5fe69ff4657b2503",
  },
];
it.each(cases)("retained-parse-errors: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.visible).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
