import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
});
afterAll(async () => runtime.dispose());
const setup =
  'sf<-srcfilecopy("owned.R","17L + 29L",timestamp=0,isFile=FALSE);p<-parse(text="17L + 29L",srcfile=sf,keep.source=TRUE);';
const cases = [
  {
    id: "missing-text-default",
    code: setup + 'attr(sf$parseData,"text")[1L]<-NA_character_;anyNA(utils::getParseData(p)$text)',
  },
  {
    id: "missing-text-full",
    code:
      setup +
      'attr(sf$parseData,"text")[1L]<-NA_character_;anyNA(utils::getParseData(p,TRUE)$text)',
  },
  {
    id: "missing-token",
    code:
      setup + 'attr(sf$parseData,"tokens")[1L]<-NA_character_;anyNA(utils::getParseData(p)$token)',
  },
  {
    id: "missing-terminal",
    code:
      setup +
      "z<-sf$parseData;z[5L,1L]<-NA_integer_;sf$parseData<-z;anyNA(utils::getParseData(p)$terminal)",
  },
  {
    id: "missing-coordinate",
    code:
      setup +
      "z<-sf$parseData;z[1L,1L]<-NA_integer_;sf$parseData<-z;anyNA(utils::getParseData(p)$line1)",
  },
  {
    id: "strict-full-text-control",
    code:
      setup +
      'a<-utils::getParseData(p,FALSE);identical(utils::getParseData(p,1),a)&&identical(utils::getParseData(p,2),a)&&identical(utils::getParseData(p,"TRUE"),a)',
  },
  {
    id: "positive-compact-row-names",
    code: 'd<-data.frame(x=1L:4L);attr(d,"row.names")<-c(NA_integer_,4L);identical(nrow(d),4L)&&identical(rownames(d),c("1","2","3","4"))&&identical(rownames(as.matrix(d)),c("1","2","3","4"))',
  },
  {
    id: "negative-compact-automatic-row-names",
    code: 'd<-data.frame(x=1L:4L);attr(d,"row.names")<-c(NA_integer_,-4L);identical(nrow(d),4L)&&identical(rownames(d),c("1","2","3","4"))&&is.null(rownames(as.matrix(d)))',
  },
  {
    id: "duplicate-ids-before-control",
    code:
      setup +
      'z<-sf$parseData;z[7L,1L]<-z[7L,2L];sf$parseData<-z;events<-character();withCallingHandlers(tryCatch(utils::getParseData(p,stop("control must stay lazy")),error=function(e){events<<-c(events,paste0("error:",conditionMessage(e)));NULL}),warning=function(w){events<<-c(events,paste0("warning:",conditionMessage(w)));invokeRestart("muffleWarning")});identical(events,c("warning:non-unique value when setting \'row.names\': \'2\'","error:duplicate \'row.names\' are not allowed"))',
  },
  {
    id: "missing-id-before-control",
    code:
      setup +
      'z<-sf$parseData;z[7L,1L]<-NA_integer_;sf$parseData<-z;identical(tryCatch(utils::getParseData(p,stop("control must stay lazy")),error=function(e)conditionMessage(e)),"missing values in \'row.names\' are not allowed")',
  },
];
it.each(cases)("source-accessor review: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(`local({${code}})`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
});
