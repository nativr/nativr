import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("preserves recycling condition calls and rejected function expressions", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      forwarded<-function(x)match.fun(x)
      c(identical(tryCatch(mapply("+",1:3,1:2),warning=conditionCall),quote(mapply("+",1:3,1:2))),
        identical(tryCatch(Map("+",1:3,1:2),warning=conditionCall),quote(mapply(FUN=f,...,SIMPLIFY=FALSE))),
        identical(capture(match.fun(42)),"'42' is not a function, character or symbol"),
        identical(capture(match.fun(42L)),"'42L' is not a function, character or symbol"),
        identical(capture(match.fun(quote(1+2))),"'quote(1 + 2)' is not a function, character or symbol"),
        identical(capture(forwarded(42+0)),"'42 + 0' is not a function, character or symbol"),
        identical(capture(do.call("match.fun",list(42))),"'42' is not a function, character or symbol"))
    `),
    ).toEqual(Array(7).fill(true));
  } finally {
    await r.dispose();
  }
});

it("shares scalar, list, factor, and higher array simplification", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      f<-function(i)matrix(1:4+i,2)
      factors<-mapply(function(z)factor(z,levels=c("x","y")),c("x","y"))
      c(identical(mapply(f,1:2),matrix(c(2:5,3:6),4)),
        identical(mapply(f,1:2,SIMPLIFY="array"),array(c(2:5,3:6),c(2,2,2))),
        identical(mapply(f,1:2,SIMPLIFY=list("array")),array(c(2:5,3:6),c(2,2,2))),
        identical(mapply(identity,1:2,SIMPLIFY=0L),1:2),
        identical(mapply(identity,1:2,SIMPLIFY=NA),1:2),
        identical(mapply(identity,1:2,SIMPLIFY=FALSE),list(1L,2L)),
        identical(mapply(function(i)list(k=i),1:2),list(k=1L,k=2L)),
        identical(mapply(function(i)list(list(k=i)),1:2),list(list(k=1L),list(k=2L))),
        identical(mapply(function(i)integer(),1:2),list(integer(),integer())),
        identical(as.integer(factors),1:2),identical(levels(factors),c("x","y")),
        identical(class(factors),"factor"),identical(names(factors),c("x","y")),
        identical(mapply(function(i)factor(c("x","y")),1:2),matrix(c("x","y","x","y"),2)))
    `),
    ).toEqual(Array(14).fill(true));
  } finally {
    await r.dispose();
  }
});

it("forces inputs and fixed arguments before mapping and controls after mapping", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-character();mark<-function(name,value){seen<<-c(seen,name);value}
      f<-function(x,y,z=0){seen<<-c(seen,paste0("call",x));x+y+z}
      value<-mapply(mark("FUN",f),mark("X",1:2),mark("Y",3:4),MoreArgs=mark("MORE",list(z=10)),USE.NAMES=mark("NAMES",TRUE),SIMPLIFY=mark("SIMPLIFY",TRUE))
      trace<-seen
      seen<-character()
      empty<-mapply(mark("FUN",f),mark("X",integer()),mark("Y",3:4),MoreArgs=mark("MORE",NULL),USE.NAMES=mark("NAMES",TRUE),SIMPLIFY=mark("SIMPLIFY",FALSE))
      emptyTrace<-seen
      seen<-character()
      warning<-tryCatch(mapply(function(x,y){seen<<-c(seen,paste0("call",x));x+y},1:3,1:2,USE.NAMES=mark("NAMES",TRUE),SIMPLIFY=mark("SIMPLIFY",TRUE)),warning=function(w){seen<<-c(seen,"warning");conditionMessage(w)})
      warningTrace<-seen
      seen<-character()
      failed<-tryCatch(mapply(function(x,y){seen<<-c(seen,paste0("call",x));if(x==2)stop("callback");x+y},1:3,1:2,USE.NAMES=mark("NAMES",TRUE),SIMPLIFY=mark("SIMPLIFY",TRUE)),error=conditionMessage)
      c(identical(value,c(14,16)),identical(trace,c("FUN","X","Y","MORE","call1","call2","NAMES","SIMPLIFY")),
        identical(empty,list()),identical(emptyTrace,c("FUN","X","Y","MORE","NAMES","SIMPLIFY")),
        identical(warning,"longer argument not a multiple of length of shorter"),identical(warningTrace,c("call1","call2","call3","warning")),
        identical(failed,"callback"),identical(seen,c("call1","call2")))
    `),
    ).toEqual(Array(8).fill(true));
    const result = await r.evalDetailed("mapply(`+`,1:3,1:2)");
    expect(result.value).toEqual([2, 4, 4]);
    expect(result.warnings).toEqual([
      { code: "NRW1001", message: "longer argument not a multiple of length of shorter" },
    ]);
  } finally {
    await r.dispose();
  }
});

it("uses eager global length, extraction, and names methods without list conversion", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-character()
      as.list.fixture<-function(...)stop("conversion")
      length.fixture<-function(x){seen<<-c(seen,"length");2L}
      \`[[.fixture\`<-function(x,i,...){seen<<-c(seen,paste0("extract",i));i+10L}
      names.fixture<-function(x){seen<<-c(seen,"names");c("u","v")}
      x<-structure(1:2,class="fixture")
      result<-mapply(identity,x);trace<-seen
      seen<-character();unused<-mapply(function(z)42,x);unusedTrace<-seen
      localResult<-local({length.fixture<-function(x)stop("local length");\`[[.fixture\`<-function(x,i,...)stop("local extraction");names.fixture<-function(x)stop("local names");mapply(identity,x)})
      c(identical(result,c(u=11L,v=12L)),identical(trace,c("length","extract1","extract2","names")),
        identical(unused,c(u=42,v=42)),identical(unusedTrace,trace),identical(localResult,result),
        identical(Map(identity,x),list(u=11L,v=12L)))
    `),
    ).toEqual(Array(6).fill(true));
  } finally {
    await r.dispose();
  }
});

it("preserves first-input name encodings and zero-result naming behavior", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      latin<-rawToChar(as.raw(233));Encoding(latin)<-"latin1"
      encoded<-mapply(identity,c(latin,NA_character_))
      padded<-suppressWarnings(mapply(function(x,y)y,c("a",NA_character_),1:3))
      c(identical(Encoding(names(encoded)),c("latin1","unknown")),identical(charToRaw(names(encoded)[1]),as.raw(233)),
        identical(names(padded),c("a",NA_character_,NA_character_)),
        identical(names(Map(identity,character())),character()),
        identical(names(mapply(function(...)1,c("x","y"),integer(),SIMPLIFY=FALSE)),character()),
        identical(mapply(identity,c(a=1,b=2),USE.NAMES=FALSE),c(1,2)),
        identical(capture(mapply(identity,1:2,USE.NAMES=NA)),"missing value where TRUE/FALSE needed"),
        identical(mapply(identity,USE.NAMES=NA),list()),
        identical(capture(mapply(identity,USE.NAMES=NULL)),"invalid 'x' type in 'x && y'"),
        identical(capture(mapply(function(i)matrix(1:4,2),1:2,SIMPLIFY=NA)),"missing value where TRUE/FALSE needed"),
        identical(capture(mapply("+",c(a=1,b=2),integer(),SIMPLIFY=stop("unused simplify"))),"'names' attribute [2] must be the same length as the vector [0]"))
    `),
    ).toEqual(Array(11).fill(true));
    await expect(r.eval("mapply(`+`,c(a=1,b=2),integer())")).rejects.toMatchObject({
      code: "NRT3004",
    });
  } finally {
    await r.dispose();
  }
});

it("admits supported raw inputs and forwards Map controls through mapply", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      c(identical(mapply("+",1:2,3:4),c(4L,6L)),
        identical(mapply(identity),list()),identical(Map(identity),list()),
        identical(mapply(identity,NULL),list()),
        identical(mapply(typeof,expression(a,1+2)),c("symbol","language")),
        identical(mapply(typeof,quote(f(a=1,b=2))),c("symbol",a="double",b="double")),
        identical(mapply(typeof,new.env()),structure(list(),names=character())),
        identical(Map(function(x,y=8)list(x,y),1:2,MoreArgs=list(y=4)),list(list(1L,4),list(2L,4))),
        identical(Map(function(x,y=8)list(x,y),1:2,MoreArgs=pairlist(y=4)),list(list(1L,8),list(2L,8))),
        identical(Map(identity,c(a="x",b="y"),USE.NAMES=FALSE),list("x","y")),
        identical(capture(Map(identity,1:2,SIMPLIFY=TRUE)),"formal argument \\"SIMPLIFY\\" matched by multiple actual arguments"),
        identical(capture(mapply(identity,1:2,MoreArgs=1)),"argument 'MoreArgs' of 'mapply' is not a list or pairlist"),
        identical(formals(mapply),formals(function(FUN,...,MoreArgs=NULL,SIMPLIFY=TRUE,USE.NAMES=TRUE)NULL)),
        identical(formals(Map),formals(function(f,...)NULL)))
    `),
    ).toEqual(Array(14).fill(true));
  } finally {
    await r.dispose();
  }
});

it("guards observed result length before extraction or callbacks", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1000 } });
  try {
    await r.eval(`
      extracted<-0L
      length.fixture<-function(x)1001L
      \`[[.fixture\`<-function(x,i,...){extracted<<-extracted+1L;i}
      x<-structure(1L,class="fixture")
    `);
    await expect(r.eval('mapply(function(x)stop("callback"),x)')).rejects.toMatchObject({
      code: "NRL4002",
    });
    expect(await r.eval("extracted")).toBe(0);
  } finally {
    await r.dispose();
  }
});
