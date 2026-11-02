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
    id: "default-source-and-parse-data",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));stopifnot(identical(getOption("keep.parse.data"),TRUE));p<-parse(text="17L + 29L",keep.source=TRUE);sf<-attr(p,"srcfile");pd<-sf$parseData;identical(names(attributes(p)),c("srcref","srcfile","wholeSrcref"))&&identical(as.integer(attr(p,"srcref")[[1L]]),c(1L,1L,1L,9L,1L,9L,1L,1L))&&identical(as.integer(attr(p,"wholeSrcref")),c(1L,0L,2L,0L,0L,0L,1L,2L))&&identical(class(sf),c("srcfilecopy","srcfile"))&&identical(sf$filename,"<text>")&&identical(sf$lines,"17L + 29L")&&identical(parent.env(sf),emptyenv())&&identical(class(pd),"parseData")&&identical(dim(pd),c(8L,6L))&&identical(as.integer(pd),c(1L,1L,1L,3L,1L,261L,1L,2L,1L,1L,1L,3L,0L,79L,2L,7L,1L,5L,1L,5L,1L,43L,3L,7L,1L,7L,1L,9L,1L,261L,4L,5L,1L,7L,1L,9L,0L,79L,5L,7L,1L,1L,1L,9L,0L,79L,7L,0L))&&identical(attr(pd,"tokens"),c("NUM_CONST","expr","\'+\'","NUM_CONST","expr","expr"))&&identical(attr(pd,"text"),c("17L","","+","29L","",""))&&identical(eval(p),46L)})',
    sourceSha256: "858448fed62eb3cf0c0f4e72b2d1fe34f5e41ebd5f703e6a2a76e993570c66a4",
  },
  {
    id: "nested-block-references",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));text<-c("{","  17L; {29L; 31L}","  37L","}");sf<-srcfilecopy("owned.R",text,timestamp=0,isFile=FALSE);p<-parse(text=text,keep.source=TRUE,srcfile=sf);b<-p[[1L]];inner<-b[[3L]];outerRefs<-lapply(attr(b,"srcref"),as.integer);innerRefs<-lapply(attr(inner,"srcref"),as.integer);identical(outerRefs,list(c(1L,1L,1L,1L,1L,1L,1L,1L),c(2L,3L,2L,5L,3L,5L,2L,2L),c(2L,8L,2L,17L,8L,17L,2L,2L),c(3L,3L,3L,5L,3L,5L,3L,3L)))&&identical(innerRefs,list(c(2L,8L,2L,8L,8L,8L,2L,2L),c(2L,9L,2L,11L,9L,11L,2L,2L),c(2L,14L,2L,16L,14L,16L,2L,2L)))&&identical(as.integer(attr(inner,"wholeSrcref")),c(1L,0L,2L,17L,0L,17L,1L,2L))&&identical(attr(inner,"srcfile"),sf)&&identical(attr(b,"srcfile"),sf)&&identical(eval(p),37L)})',
    sourceSha256: "15c249d30ffeebb26d6d3b13173df1396eaf3ce418a45b1ad399943e7d053037",
  },
  {
    id: "parsed-function-propagation",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));text<-c("function(x = 1L) {","  x + 2L","}");sf<-srcfilecopy("owned.R",text,timestamp=0,isFile=FALSE);p<-parse(text=text,keep.source=TRUE,srcfile=sf);q<-p[[1L]];f<-eval(as.call(as.list(q)));sf$marker<-71L;identical(as.integer(q[[4L]]),c(1L,1L,3L,1L,1L,1L,1L,3L))&&identical(class(q[[4L]]),"srcref")&&identical(attr(q[[4L]],"srcfile"),sf)&&identical(names(attributes(f)),"srcref")&&identical(attr(f,"srcref"),q[[4L]],ignore.srcref=FALSE)&&identical(attr(body(f),"srcfile"),sf)&&identical(attr(attr(f,"srcref"),"srcfile")$marker,71L)&&identical(body(f),q[[3L]],ignore.srcref=FALSE)&&identical(f(),3L)})',
    sourceSha256: "31302415957b1b7f59b51f8517a4804c27ab69f595ffb5b5449ff28fd3d474c8",
  },
  {
    id: "tabs-and-utf8-columns",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));text<-c(paste0(\'"\',intToUtf8(c(233L,128512L)),\'"; 17L\'),paste0(\'\t"\',intToUtf8(233L),\'";29L\'));sf<-srcfilecopy("owned.R",text,timestamp=0,isFile=FALSE);p<-parse(text=text,keep.source=TRUE,srcfile=sf,encoding="UTF-8");identical(lapply(attr(p,"srcref"),as.integer),list(c(1L,1L,1L,8L,1L,4L,1L,1L),c(1L,11L,1L,13L,7L,9L,1L,1L),c(2L,2L,2L,5L,9L,11L,2L,2L),c(2L,7L,2L,9L,13L,15L,2L,2L)))&&identical(eval(p),29L)})',
    sourceSha256: "f3bb39b583a4c29bff773646b9692924348c303b7561eaa3bd641c78990170aa",
  },
  {
    id: "finite-n-consumed-position",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));sf<-srcfilecopy("owned.R",c("17L  ; 29L","31L"),timestamp=0,isFile=FALSE);p<-parse(text=c("17L  ; 29L","31L"),n=1L,keep.source=TRUE,srcfile=sf);q<-parse(text=c("17L","29L +"),n=1L,keep.source=TRUE);identical(length(p),1L)&&identical(as.integer(attr(p,"wholeSrcref")),c(1L,0L,1L,6L,0L,6L,1L,1L))&&identical(as.integer(attr(q,"wholeSrcref")),c(1L,0L,2L,0L,0L,0L,1L,2L))&&identical(attr(sf$parseData,"tokens"),c("NUM_CONST","expr","\';\'"))&&identical(eval(p),17L)&&identical(eval(q),17L)})',
    sourceSha256: "499a3146e528b66ce2dac0783baf39ccccf9109fd1ed4dfb19cb1318560d4644",
  },
  {
    id: "source-selection-and-disabled-data",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));options(keep.parse.data=FALSE);sf<-srcfilecopy("owned.R","different source lines",timestamp=0,isFile=FALSE);sf$parseData<-71L;a<-parse(text="17L",keep.source=FALSE,srcfile=sf);b<-parse(text="17L",keep.source=TRUE,srcfile=NULL);d<-parse(text="17L",keep.source=TRUE,srcfile="owned-string.R");identical(attr(a,"srcfile"),sf)&&identical(sf$lines,"different source lines")&&identical(sf$parseData,71L)&&is.null(attributes(b))&&is.null(attributes(d))&&identical(eval(a),17L)})',
    sourceSha256: "fedf7b021bc238b900b30e7267ae1511c6130a0b7e3a3f7d3839d816c63e7cd5",
  },
  {
    id: "empty-and-zero-n",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));a<-parse(text="",keep.source=TRUE);b<-parse(text=character(),keep.source=TRUE);d<-parse(text="17L",n=0L,keep.source=TRUE);identical(length(a),0L)&&identical(names(attributes(a)),c("srcref","srcfile","wholeSrcref"))&&identical(attr(a,"srcref"),list())&&identical(as.integer(attr(a,"wholeSrcref")),c(1L,0L,2L,0L,0L,0L,1L,2L))&&identical(dim(attr(a,"srcfile")$parseData),c(8L,0L))&&is.null(attributes(b))&&is.null(attributes(d))})',
    sourceSha256: "241c5258d7f9a328c3dd28430e40f7a73ab37f6895932c1cba8d236dffe1a923",
  },
  {
    id: "line-directive-logical-physical",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));text<-c(\'#line 41 "owned-mapped.R"\',\' 17L\',\'29L\');sf<-srcfilecopy("owned.R",text,timestamp=0,isFile=FALSE);p<-parse(text=text,keep.source=TRUE,srcfile=sf);alias<-attr(p,"srcfile");r<-attr(p,"srcref");identical(lapply(r,as.integer),list(c(41L,2L,41L,4L,2L,4L,2L,2L),c(42L,1L,42L,3L,1L,3L,3L,3L)))&&identical(as.integer(attr(p,"wholeSrcref")),c(1L,0L,43L,0L,0L,0L,1L,4L))&&identical(class(alias),c("srcfilealias","srcfile"))&&identical(alias$filename,"owned-mapped.R")&&identical(alias$original,sf)&&identical(attr(r[[1L]],"srcfile"),alias)&&identical(attr(r[[2L]],"srcfile"),alias)&&identical(eval(p),29L)})',
    sourceSha256: "e33538ee947c736244de3e0ff9a4be5bd2d8fb043bcc4893835b2130789fa988",
  },
  {
    id: "source-lines-normalization",
    code: 'local({old<-options(keep.source=FALSE);on.exit(options(old));text<-c("17L\\n29L","31L\\n","37L");sf<-srcfilecopy("owned.R",text,timestamp=0,isFile=FALSE);before<-sf$lines;p<-parse(text=text,keep.source=TRUE,srcfile=sf);identical(before,c("17L","29L","31L","","37L"))&&identical(sf$lines,before)&&identical(sf$fixedNewlines,TRUE)&&identical(lapply(attr(p,"srcref"),as.integer),list(c(1L,1L,1L,3L,1L,3L,1L,1L),c(2L,1L,2L,3L,1L,3L,2L,2L),c(3L,1L,3L,3L,1L,3L,3L,3L),c(5L,1L,5L,3L,1L,3L,5L,5L)))&&identical(eval(p),37L)})',
    sourceSha256: "d5b7d46c6bda8f3ceee2be4ef48e4ff8e629526948c7c09e992f9cbd6001a84a",
  },
];
it.each(cases)("retained-parse: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.visible).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
