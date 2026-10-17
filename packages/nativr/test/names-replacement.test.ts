import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("coerces replacement names with generic and direct attribute semantics", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
        as.character.fixture<-function(x,...) c("custom",NA_character_)
        nm<-structure(c("old","text"),class="fixture")
        assigned<-1:3;names(assigned)<-nm
        direct<-1:3;attr(direct,"names")<-nm
        codes<-1:3;attr(codes,"names")<-factor(c("b","a"))
        tags<-1:3;attr(tags,"names")<-pairlist(1L,NA_integer_)
        literal<-c("A","B");symbolic<-1:2;names(symbolic)<-quote(literal)
        c(identical(names(assigned),c("custom",NA,NA)),
          identical(names(setNames(1:3,nm)),c("old","text",NA)),
          identical(names(direct),c("old","text",NA)),
          identical(names(structure(1:3,names=nm)),c("old","text",NA)),
          identical(names(setNames(1:3,factor(c("b","a")))),c("b","a",NA)),
          identical(names(codes),c("2","1",NA)),
          identical(names(setNames(1:4,list(1:2,NA_character_,factor("f")))),c("1:2",NA,"1",NA)),
          identical(names(tags),c("1",NA,"")),
          identical(names(symbolic),c("A","B")),
          identical(names(setNames(1:3,as.raw(c(1,255)))),c("01","ff",NA)),
          identical(names(setNames(1:3,c(1.5,NaN))),c("1.5","NaN",NA)))
      })`),
    ).toEqual(Array(11).fill(true));
  } finally {
    await r.dispose();
  }
});

it("retains character bytes and handles pairlist tags, arrays, and replacement failures", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
        bytes<-rawToChar(as.raw(233));Encoding(bytes)<-"latin1"
        named<-setNames(1:2,c(bytes,NA_character_))
        padded<-setNames(1:2,bytes)
        tags<-pairlist(1,2,3);names(tags)<-c(NA,"a")
        emptytags<-pairlist(1,2);names(emptytags)<-c(NA,NA)
        a<-array(1:2,2,dimnames=list(axis=c("a","b")));names(a)<-"z"
        b<-a;names(b)<-NULL
        msg<-function(expr)tryCatch(expr,error=conditionMessage)
        as.character.fixture<-function(x,...)stop("coercion first")
        c(identical(Encoding(names(named)),c("latin1","unknown")),
          identical(charToRaw(names(named)[1]),as.raw(233)),
          identical(Encoding(names(padded)),c("latin1","unknown")),
          identical(names(padded)[2],NA_character_),
          identical(names(tags),c("","a","")),is.null(names(emptytags)),
          identical(attributes(a),list(dim=2L,dimnames=list(c("z",NA_character_)))),
          identical(attributes(b),list(dim=2L)),
          identical(msg(setNames(1:2,1:3)),"'names' attribute [3] must be the same length as the vector [2]"),
          identical(msg(setNames(NULL,character())),"attempt to set an attribute on NULL"),
          is.null(setNames(NULL,NULL)),
          identical(msg({x<-new.env();names(x)<-structure(1,class="fixture")}),"coercion first"),
          identical(msg(setNames(new.env(),"x")),"names() applied to a non-vector"),
          identical(msg({x<-1:2;attr(x,"names")<-pairlist(1:2)}),"incompatible 'names' argument"))
      })`),
    ).toEqual(Array(14).fill(true));
  } finally {
    await r.dispose();
  }
});

it("normalizes results from globally visible character conversion methods once", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
        seen<-0L
        as.character.fixture<-function(x,...){seen<<-seen+1L;list("renamed",NA_character_)}
        input<-structure(1L,class="fixture")
        a<-setNames(1:3,input)
        as.character.fixture<-function(x,...)NULL
        b<-setNames(c(old=1),input)
        as.character.fixture<-function(x,...)pairlist(NA_integer_)
        d<-setNames(1:2,input)
        as.character.fixture<-function(x,...)factor(c("b","a"))
        e<-setNames(1:2,input)
        marked<-structure(c("a","b"),tag=2,names=c("p","q"))
        exact<-1:2;attr(exact,"names")<-marked
        padded<-1:3;attr(padded,"names")<-marked
        c(identical(names(a),c("renamed",NA,NA)),seen==1L,
          is.null(names(b)),identical(names(d),c(NA,"")),
          identical(as.character(unclass(names(e))),c("2","1")),
          identical(attributes(names(e)),list(levels=c("a","b"),class="factor")),
          identical(names(exact),marked),identical(names(padded),c(p="a",q="b",NA_character_)))
      `),
    ).toEqual(Array(8).fill(true));
  } finally {
    await r.dispose();
  }
});
