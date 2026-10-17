import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("preserves time subclasses and scalar metadata through list conversion and apply", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
        xs<-list(structure(c(1,NA_real_),class=c("custom","Date"),names=c(NA,""),tag="drop"),structure(c(1,NA_real_),class=c("custom","POSIXct","POSIXt"),tzone="UTC",names=c(NA,""),tag="drop"),structure(c(1,NA_real_),class=c("custom","difftime"),units="hours",names=c(NA,""),tag="drop"))
        expected<-list(list(structure(1,class=c("custom","Date")),structure(NA_real_,class=c("custom","Date"))),list(structure(1,class=c("custom","POSIXct","POSIXt"),tzone="UTC"),structure(NA_real_,class=c("custom","POSIXct","POSIXt"),tzone="UTC")),list(structure(1,class=c("custom","difftime"),units="hours"),structure(NA_real_,class=c("custom","difftime"),units="hours")))
        c(vapply(1:3,function(i)identical(as.list(xs[[i]]),setNames(expected[[i]],c(NA,""))),logical(1)),vapply(1:3,function(i)identical(lapply(xs[[i]],identity),setNames(expected[[i]],c(NA,""))),logical(1)),identical(as.list.POSIXct(structure(numeric(),names=character(),class="POSIXct",tzone="UTC")),setNames(list(),character())))
      })`),
    ).toEqual(Array(7).fill(true));
    expect(
      await r.eval(`local({
        item<-structure(1,names="n",class="inner",tzone="Z",units="s",keep="yes")
        x<-structure(list(item),class="outer",tzone="Zone",units="weeks",custom="drop")
        c(identical(as.list.Date(x),list(structure(1,names="n",class="outer",tzone="Z",units="s",keep="yes"))),identical(as.list.POSIXct(x),list(structure(1,names="n",class="outer",tzone="Zone",units="s",keep="yes"))),identical(as.list.difftime(x),list(structure(1,names="n",class="outer",tzone="Z",units="weeks",keep="yes"))),identical(as.list.POSIXct(list(item)),list(structure(1,names="n",units="s",keep="yes"))),identical(as.list.Date(quote(f(a,b))),list(quote(f),quote(a),quote(b))),identical(as.list.Date(quote(a)),list(quote(a))))
      })`),
    ).toEqual(Array(6).fill(true));
  } finally {
    await r.dispose();
  }
});

it("uses global names dispatch and lazy partial metadata lookup", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        options(warnPartialMatchAttr=TRUE)
        events<-character()
        globalCallingHandlers(warning=function(w)events<<-c(events,conditionMessage(w)))
        names.fixture<-function(x){events<<-c(events,"names");"one"}
        length.fixture<-function(x)stop("unused length")
        \`[[.fixture\`<-function(x,...)stop("unused extraction")
        x<-structure(1:2,class=c("fixture","POSIXct"),tzone.extra="UTC")
        converted<-as.list(x)
        first<-events;events<-character()
        message<-tryCatch(as.list.POSIXct(structure(list(NULL),class=c("fixture","POSIXct"),tzone.extra="UTC")),error=function(e)conditionMessage(e))
        list(first,names(converted),lapply(converted,function(x)attr(x,"tzone")),events,message,local({names.fixture<-function(x)stop("local names");names(as.list.POSIXct(structure(1:2,class=c("fixture","POSIXct"))))}))
      `),
    ).toEqual([
      ["names", "partial argument match of 'tzone' to 'tzone.extra'"],
      ["one", { __nativr__: "NA" }],
      ["UTC", "UTC"],
      "names",
      "attempt to set an attribute on NULL",
      ["one", { __nativr__: "NA" }],
    ]);
  } finally {
    await r.dispose();
  }
});

it("preserves names masks while distinguishing actual and derived attributes", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `local({x<-array(1:2,2,list(c(NA,"")));y<-structure(1,tzone.extra="UTC",units.one="hours",units.two="days");c(identical(attr(x,"names"),c(NA,"")),identical(names(x),c(NA,"")),identical(names(as.list(x)),c(NA,"")),identical(names(as.list.Date(x)),c(NA,"")),identical(names(as.list.POSIXct(x)),c(NA,"")),identical(attr(setNames(1:2,c(NA,"")),"names"),c(NA,"")),identical(attr(y,"tzone"),"UTC"),is.null(attr(y,"tzone",exact=TRUE)),is.null(attr(y,"units")))})`,
      ),
    ).toEqual(Array(9).fill(true));
  } finally {
    await r.dispose();
  }
});
