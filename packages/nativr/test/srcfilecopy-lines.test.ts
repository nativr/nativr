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
    id: "line-segment-matrix",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f("a\\nb"),c("a","b"))&&identical(f("a\\n"),c("a",""))&&identical(f("\\na"),c("","a"))&&identical(f("\\n\\n"),c("","",""))&&identical(f(c("a\\n\\nb\\n","\\n","")),c("a","","b","","","",""))})',
    sourceSha256: "a4031f0e35d9e91ec11c0ab8d052ee341074104939346535208299c8deedbcf4",
  },
  {
    id: "crlf-literal-boundaries",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f(c("a\\r\\nb","c\\r\\n")),c("a\\r","b","c\\r",""))&&identical(f("a\\rb\\r"),"a\\rb\\r")&&identical(f(c("a\\\\nb","a\\tb","a\\nb")),c("a\\\\nb","a\\tb","a","b"))})',
    sourceSha256: "87a3595c9ca31a9adcc9cefc2b8224449c380f0ebee22fc8436157a4bf27eb65",
  },
  {
    id: "empty-and-null",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f(NULL),character())&&identical(f(character()),character())&&identical(f(""),"")&&identical(f(c("","a","")),c("","a",""))})',
    sourceSha256: "ded9f6a88fc52757a8848a9ab99d11edfd3d26bb3f2aa505667ead250ab98c7c",
  },
  {
    id: "missing-lines-data",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f(NA_character_),NA_character_)&&identical(f(c("a\\nb",NA_character_,"")),c("a","b",NA_character_,""))&&identical(f(c(17L,NA_integer_,29L)),c("17",NA_character_,"29"))})',
    sourceSha256: "821429acb0714f8fe351124c2ae705be4ddfc5d5dd78ca1330fe555670e99fce",
  },
  {
    id: "atomic-coercion",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f(c(TRUE,FALSE,NA)),c("TRUE","FALSE",NA_character_))&&identical(f(c(1.5,NA_real_,NaN,Inf,-Inf)),c("1.5",NA_character_,"NaN","Inf","-Inf"))&&identical(f(as.raw(c(10L,13L,255L))),c("0a","0d","ff"))&&identical(f(c(1+2i,NA_complex_)),c("1+2i",NA_character_))})',
    sourceSha256: "905f1083b6db55b8e357615e53457a7fcfe21cdfcac87cc1367e35717fd8dc28",
  },
  {
    id: "factor-list-pairlist-coercion",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;identical(f(factor(c("a\\nb",NA_character_,"c"))),c("a","b",NA_character_,"c"))&&identical(f(list("a\\nb",17L,NULL,c("q","r"))),c("a","b","17","NULL","c(\\"q\\", \\"r\\")"))&&identical(f(pairlist(a="one\\ntwo",b=17L)),c("one","two","17"))})',
    sourceSha256: "7690bb34eff68a310a945e77eabeabff8ff10a5adf021bf8860b9bb7898f5f10",
  },
  {
    id: "stripped-line-attributes",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({f<-function(x)srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE)$lines;owner<-new.env(parent=emptyenv());owner$marker<-17L;x<-structure(c(first="a\\nb",second="c"),owner=owner);v<-f(x);owner$marker<-29L;identical(v,c("a","b","c"))&&is.null(attributes(v))&&identical(attr(x,"owner"),owner)&&identical(attr(x,"owner")$marker,29L)&&identical(f(matrix(c("a","b","c","d"),2L,2L)),c("a","b","c","d"))&&identical(f(structure(c(first="a",second="b"),note="owned")),c("a","b"))})',
    sourceSha256: "569c37babfa40a785e5da7b6c78a61b8347ea4ca5cd39583a000f4ea75c51b4f",
  },
  {
    id: "source-environment-fields",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({sf<-srcfilecopy("owned.R",c("a\\nb",NA_character_),timestamp=0,isFile=FALSE);identical(class(sf),c("srcfilecopy","srcfile"))&&identical(names(attributes(sf)),"class")&&identical(parent.env(sf),emptyenv())&&identical(ls(sf,all.names=TRUE),c("Enc","filename","fixedNewlines","isFile","lines","timestamp","wd"))&&identical(sf$filename,"owned.R")&&identical(sf$timestamp,0)&&identical(sf$isFile,FALSE)&&identical(sf$Enc,"unknown")&&identical(sf$fixedNewlines,TRUE)&&is.character(sf$wd)&&identical(length(sf$wd),1L)&&identical(sf$lines,c("a","b",NA_character_))})',
    sourceSha256: "f2ab34f2217811938312a26c648de409531fe71c6b3fe577fa54a00c0786f351",
  },
  {
    id: "source-copy-independence",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({x<-c("a\\nb","c");a<-srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE);b<-srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE);before<-a$lines;x[[1L]]<-"changed-input";a$lines[[2L]]<-"changed-source";a$marker<-71L;!identical(a,b)&&identical(x,c("changed-input","c"))&&identical(before,c("a","b","c"))&&identical(a$lines,c("a","changed-source","c"))&&identical(b$lines,c("a","b","c"))&&!exists("marker",b,inherits=FALSE)})',
    sourceSha256: "d7353051ed67a8a1568bbf0f124c9481eab6998c4cb64971814526a06d42cefc",
  },
  {
    id: "encoding-latin1-global-branch",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({x<-rawToChar(as.raw(c(233L,241L)));Encoding(x)<-"latin1";a<-srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE);b<-srcfilecopy("owned.R",c(x,"a\\nb"),timestamp=0,isFile=FALSE);identical(charToRaw(a$lines),as.raw(c(233L,241L)))&&identical(Encoding(a$lines),"latin1")&&identical(lapply(b$lines,charToRaw),list(as.raw(c(195L,169L,195L,177L)),as.raw(97L),as.raw(98L)))&&identical(Encoding(b$lines),c("UTF-8","unknown","unknown"))&&identical(b$Enc,"unknown")&&identical(b$fixedNewlines,TRUE)})',
    sourceSha256: "bb524fe0134fb5b3c779a72503c8cd0df5bf2b45b028aaf120a68547783c967f",
  },
  {
    id: "encoding-bytes-and-utf8",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({x<-rawToChar(as.raw(c(233L,241L)));Encoding(x)<-"bytes";a<-srcfilecopy("owned.R",c(x,"a\\nb"),timestamp=0,isFile=FALSE);u<-paste0(intToUtf8(233L),"\\n",intToUtf8(128512L));b<-srcfilecopy("owned.R",u,timestamp=0,isFile=FALSE);identical(lapply(a$lines,charToRaw),list(as.raw(c(233L,241L)),as.raw(97L),as.raw(98L)))&&identical(Encoding(a$lines),c("bytes","unknown","unknown"))&&identical(b$lines,c(intToUtf8(233L),intToUtf8(128512L)))&&identical(Encoding(b$lines),c("UTF-8","UTF-8"))&&identical(a$Enc,"unknown")&&identical(b$Enc,"unknown")})',
    sourceSha256: "04ed0253a0f9fa7f4236d1138cf44da8f96635b144a82375afda04832efccb30",
  },
  {
    id: "local-method-lookup",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({events<-0L;as.character.owned_lines<-function(x,...){events<<-events+1L;"owned\\nconverted"};x<-structure(17L,class="owned_lines");direct<-as.character(x);before<-events;sf<-srcfilecopy("owned.R",x,timestamp=0,isFile=FALSE);identical(direct,"owned\\nconverted")&&identical(before,1L)&&identical(sf$lines,"17")&&identical(events,1L)})',
    sourceSha256: "ea9a9e13a836c0a5c31df57e640f2b88c47721bf23f30071aefe6127e4861541",
  },
  {
    id: "global-integer-method-branch",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({events<-0L;assign("as.character.owned_lines",function(x,...){events<<-events+1L;if(events==1L)"first\\nprobe"else"second\\nresult"},envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));a<-srcfilecopy("owned.R",structure(17L,class="owned_lines"),timestamp=0,isFile=FALSE);firstCount<-events;events<-0L;assign("as.character.owned_lines",function(x,...){events<<-events+1L;if(events==1L)"first"else"second\\nresult"},envir=.GlobalEnv);b<-srcfilecopy("owned.R",structure(17L,class="owned_lines"),timestamp=0,isFile=FALSE);identical(a$lines,c("second","result"))&&identical(firstCount,2L)&&identical(b$lines,"second\\nresult")&&identical(events,2L)&&identical(b$fixedNewlines,TRUE)})',
    sourceSha256: "e139ce5cbbaee032fc450cba555b81af4025396defad5263b7f3158874fb93a2",
  },
  {
    id: "global-character-method-branch",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({events<-0L;assign("as.character.owned_lines",function(x,...){events<<-events+1L;"new\\nvalue"},envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));a<-srcfilecopy("owned.R",structure("raw",class="owned_lines"),timestamp=0,isFile=FALSE);firstCount<-events;events<-0L;b<-srcfilecopy("owned.R",structure("raw\\ninput",class="owned_lines"),timestamp=0,isFile=FALSE);identical(a$lines,"new\\nvalue")&&identical(firstCount,1L)&&identical(b$lines,c("new","value"))&&identical(events,1L)&&identical(a$fixedNewlines,TRUE)})',
    sourceSha256: "5be94d4e6df2cee9bd32c81911fc417cc9c49c798f4551abf4352c0fc3ad670c",
  },
  {
    id: "missing-argument-error",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({seen<-NULL;value<-tryCatch(srcfilecopy("owned.R",timestamp=0,isFile=FALSE),error=function(e){seen<<-list(classes=class(e),message=conditionMessage(e));NULL});is.null(value)&&identical(seen$classes,c("getvarError","missingArgError","error","condition"))&&identical(seen$message,"argument \\"lines\\" is missing, with no default")})',
    sourceSha256: "58a28ed6528436860acaafcff691ea6434f90ef327a9398f606e20c34a1d0460",
  },
  {
    id: "environment-coercion-error",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({seen<-NULL;value<-tryCatch(srcfilecopy("owned.R",new.env(parent=emptyenv()),timestamp=0,isFile=FALSE),error=function(e){seen<<-list(classes=class(e),message=conditionMessage(e));NULL});is.null(value)&&identical(seen$classes,c("simpleError","error","condition"))&&identical(seen$message,"cannot coerce type \'environment\' to vector of type \'character\'")})',
    sourceSha256: "0b01b598f9380d5b3497d254766c83924688f507bf12b2ac615b48fe5c25c85b",
  },
  {
    id: "global-method-error",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({assign("as.character.owned_lines",function(x,...)stop("owned line coercion failure"),envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));seen<-NULL;value<-tryCatch(srcfilecopy("owned.R",structure(17L,class="owned_lines"),timestamp=0,isFile=FALSE),error=function(e){seen<<-conditionMessage(e);NULL});is.null(value)&&identical(seen,"owned line coercion failure")})',
    sourceSha256: "c433918a2ae242d1718b7267f9fa5d3569388ab88f12b85a4f5f5bfa7830986a",
  },
  {
    id: "global-noncharacter-error",
    cohort: "srcfilecopy-lines-prerequisite",
    code: 'local({assign("as.character.owned_lines",function(x,...)17L,envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));seen<-NULL;value<-tryCatch(srcfilecopy("owned.R",structure(17L,class="owned_lines"),timestamp=0,isFile=FALSE),error=function(e){seen<<-list(classes=class(e),message=conditionMessage(e));NULL});is.null(value)&&identical(seen$classes,c("simpleError","error","condition"))&&identical(seen$message,"invalid \'text\' argument")})',
    sourceSha256: "969fee5a59d2fdeb705da917473c08c26b33e9fd7400d3c836cc9a2ea7174ad5",
  },
];

it.each(cases)("srcfilecopy lines: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.visible).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
  expect(result.output).toEqual([]);
});
