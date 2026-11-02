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
const setup =
  'sf<-srcfilecopy("owned.R","17L + 29L",timestamp=0,isFile=FALSE);p<-parse(text="17L + 29L",srcfile=sf,keep.source=TRUE);d<-utils::getParseData(p);';

// Separate adjunct: expected fields come from owned black-box consumer/active-binding observations.
const cases = [
  {
    id: "file-backed-source",
    code: 'file<-tempfile();on.exit(unlink(file));writeLines(c("alpha","beta","gamma"),file);sf<-new.env(parent=emptyenv());class(sf)<-"srcfile";sf$filename<-file;sf$wd<-getwd();sf$encoding<-"";sf$Enc<-"unknown";sf$timestamp<-file.info(file)$mtime;identical(getSrcLines(sf,2L,9L),c("beta","gamma"))&&is.null(sf$lines)',
  },
  {
    id: "source-accessor-signatures",
    code: 'identical(names(formals(base::getSrcLines)),c("srcfile","first","last"))&&identical(names(formals(utils::getParseData)),c("x","includeText"))&&identical(formals(utils::getParseData)$includeText,NA)',
  },
  {
    id: "row-label-access",
    code: setup + 'identical(rownames(d),c("7","1","2","3","4","5"))&&identical(dim(d),c(6L,9L))',
  },
  {
    id: "integer-row-subset",
    code:
      setup +
      'x<-d[c(2L,1L),c("id","token")];identical(x$id,c(1L,7L))&&identical(x$token,c("NUM_CONST","expr"))&&identical(attr(x,"row.names"),c(1L,7L))',
  },
  {
    id: "integer-row-matrix",
    code:
      setup +
      'x<-as.matrix(d[,c("id","parent"),drop=FALSE]);identical(as.integer(x),c(7L,1L,2L,3L,4L,5L,0L,2L,7L,7L,5L,7L))&&identical(dimnames(x),list(c("7","1","2","3","4","5"),c("id","parent")))',
  },
  {
    id: "integer-row-print",
    code:
      setup +
      'identical(capture.output(print(d[,c("id","token"),drop=FALSE])),c("  id     token","7  7      expr","1  1 NUM_CONST","2  2      expr","3  3       \'+\'","4  4 NUM_CONST","5  5      expr"))',
  },
  {
    id: "text-active-reads",
    code:
      setup +
      'rm("lines",envir=sf);n<-0L;makeActiveBinding("lines",function(v){n<<-n+1L;"17L + 29L"},sf);x<-utils::getParseData(p,includeText=TRUE);identical(n,6L)&&identical(x$text,c("17L + 29L","17L","17L","+","29L","29L"))',
  },
  {
    id: "source-active-reads",
    code: 'sf<-srcfilecopy("owned.R","a",timestamp=0,isFile=FALSE);rm("lines",envir=sf);n<-0L;makeActiveBinding("lines",function(v){n<<-n+1L;c("alpha","beta")},sf);x<-getSrcLines(sf,1L,2L);identical(x,c("alpha","beta"))&&identical(n,2L)',
  },
  {
    id: "no-data-lazy-control",
    code: 'sf<-srcfilecopy("owned.R","17L",timestamp=0,isFile=FALSE);is.null(utils::getParseData(sf,includeText=stop("control must stay lazy")))&&is.null(utils::getParseData(NULL,includeText=stop("control must stay lazy")))',
  },
  {
    id: "multiline-text",
    code: 's<-c("17L +","29L");sf<-srcfilecopy("owned.R",s,timestamp=0,isFile=FALSE);p<-parse(text=s,srcfile=sf,keep.source=TRUE);d<-utils::getParseData(p,includeText=TRUE);identical(d$text,c("17L +\n29L","17L","17L","+","29L","29L"))',
  },
  {
    id: "tab-text",
    code: 's<-"17L +\t29L";sf<-srcfilecopy("owned.R",s,timestamp=0,isFile=FALSE);p<-parse(text=s,srcfile=sf,keep.source=TRUE);identical(utils::getParseData(p,includeText=TRUE)$text,c("17L +\t29L","17L","17L","+","29L","29L"))',
  },
  {
    id: "utf8-text",
    code: 's<-paste0(\'"\',intToUtf8(c(233L,128512L)),\'" + "z"\');sf<-srcfilecopy("owned.R",s,timestamp=0,isFile=FALSE);p<-parse(text=s,srcfile=sf,keep.source=TRUE,encoding="UTF-8");d<-utils::getParseData(p,includeText=TRUE);a<-paste0(\'"\',intToUtf8(c(233L,128512L)),\'"\');identical(d$text,c(s,a,a,"+",\'"z"\',\'"z"\'))&&identical(d$col1,c(1L,1L,1L,6L,8L,8L))&&identical(d$col2,c(10L,4L,4L,6L,10L,10L))',
  },
  {
    id: "integer-row-numeric-consumers",
    code:
      setup +
      'm<-d[,c("id","parent"),drop=FALSE];labels<-c("7","1","2","3","4","5");identical(names(rowMeans(m)),labels)&&identical(dimnames(t(m)),list(c("id","parent"),labels))&&identical(dimnames(scale(m,center=FALSE,scale=FALSE)),list(labels,c("id","parent")))&&identical(dimnames(is.na(m)),list(labels,c("id","parent")))',
  },
  {
    id: "integer-row-named-replacement",
    code:
      setup +
      'd["7","id"]<-83L;identical(d$id,c(83L,1L,2L,3L,4L,5L))&&identical(rownames(d),c("7","1","2","3","4","5"))',
  },
  {
    id: "integer-row-coordinate-subset",
    code: setup + 'index<-matrix(c("7","1","id","parent"),ncol=2L);identical(d[index],c("7","2"))',
  },
];
it.each(cases)("source-accessor boundary: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(`local({${code}})`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
});
