import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("preserves factor scalar levels, classes, missingness, and outer names in list conversion", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        levels<-structure(c("low","high"),names=c("L","H"),tag="levels")
        classes<-structure(c("fixture","ordered","factor"),tag="class")
        x<-structure(c(1L,NA_integer_,2L),class=classes,levels=levels,names=c("a",NA,""),tag="outer")
        expected<-structure(list(structure(1L,levels=levels,class=classes),structure(NA_integer_,levels=levels,class=classes),structure(2L,levels=levels,class=classes)),names=c("a",NA,""))
        c(identical(as.list(x),expected),identical(lapply(x,identity),expected),identical(as.list(list(inner=x)),list(inner=x)),identical(as.list(structure(integer(),class="factor",levels=character(),names=character())),structure(list(),names=character())))
      `),
    ).toEqual([true, true, true, true]);
    expect(
      await r.eval(`
        item<-as.list(x)[[1L]]
        c(names(attr(x,"levels")),attr(attr(x,"levels"),"tag"),attr(attr(x,"class"),"tag"),names(attr(item,"levels")),attr(attr(item,"levels"),"tag"),attr(attr(item,"class"),"tag"))
      `),
    ).toEqual(["L", "H", "levels", "class", "L", "H", "levels", "class"]);
  } finally {
    await r.dispose();
  }
});

it("uses global factor length, extraction, and names methods in native evaluation order", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        seen<-character()
        x<-structure(1:3,class=c("fixture","factor"),levels=c("a","b","c"))
        length.fixture<-function(x){seen<<-c(seen,"length");2L}
        \`[[.fixture\`<-function(x,i,...){seen<<-c(seen,paste0("extract",i));structure(i+10L,tag="item")}
        names.fixture<-function(x){seen<<-c(seen,"names");c("u","v")}
        result<-as.list.factor(x,stop("unused dots"))
        c(identical(result,list(u=structure(11L,tag="item"),v=structure(12L,tag="item"))),identical(seen,c("length","length","extract1","extract2","names","names")))
      `),
    ).toEqual([true, true]);
    expect(
      await r.eval(`
        rm(length.fixture,\`[[.fixture\`,names.fixture)
        expected<-as.list(x)
        local({length.fixture<-function(x)stop("local length");\`[[.fixture\`<-function(x,i,...)stop("local extraction");names.fixture<-function(x)stop("local names");identical(as.list.factor(x),expected)})
      `),
    ).toBe(true);
    expect(
      await r.eval(`
        n<-0
        length.fixture<-function(x){n<<-n+1;if(n==1)3L else 1L}
        \`[[.fixture\`<-function(x,i,...)i+10L
        names.fixture<-function(x)NULL
        identical(as.list.factor(x),list(11L,NULL,NULL))
      `),
    ).toBe(true);
  } finally {
    await r.dispose();
  }
});

it("accepts direct factor-method storage and applies NULL element replacement", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        c(identical(as.list.factor(NULL),list()),identical(as.list.factor(structure(1:2,class="wrong")),list(1L,2L)),identical(as.list.factor(quote(f(a=1,b=2))),list(quote(f),a=1,b=2)),identical(as.list.factor(expression(a,1+2)),list(quote(a),quote(1+2))),identical(as.list.factor(list(1,NULL)),list(1)),identical(as.list.factor(list(NULL,1)),list(NULL,1)),identical(as.list.factor(new.env()),structure(list(),names=character())),identical(names(formals(as.list.factor)),c("x","...")))
      `),
    ).toEqual(Array(8).fill(true));
    expect(
      await r.eval("tryCatch(as.list.factor(quote(x)),error=function(e)conditionMessage(e))"),
    ).toBe("object of type 'symbol' is not subsettable");
  } finally {
    await r.dispose();
  }
});
