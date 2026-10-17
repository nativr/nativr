import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("distinguishes scalar logical FALSE from lazy array simplification controls", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      f<-function(i)matrix(1:4+i,2)
      flat<-matrix(c(2:5,3:6),4)
      higher<-array(c(2:5,3:6),c(2,2,2))
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      c(identical(sapply(1:2,f,simplify=FALSE),list(f(1L),f(2L))),
        identical(sapply(1:2,f,simplify=structure(FALSE,class="fixture",tag=2)),list(f(1L),f(2L))),
        identical(sapply(1:2,f,simplify=structure(FALSE,dim=1L)),list(f(1L),f(2L))),
        identical(sapply(1:2,f,simplify=0L),flat),
        identical(sapply(1:2,f,simplify=list(TRUE)),flat),
        identical(sapply(1:2,f,simplify=as.raw(1)),flat),
        identical(sapply(1:2,f,simplify="array"),higher),
        identical(sapply(1:2,f,simplify=list("array")),higher),
        identical(sapply(1:2,f,simplify=expression("array")),higher),
        identical(sapply(1:2,f,simplify=quote(array)),higher),
        identical(sapply(1:2,identity,simplify=function()NULL),1:2),
        identical(sapply(1:2,seq_len,simplify=function()NULL),list(1L,1:2)),
        identical(sapply(integer(),identity,simplify=function()NULL),list()),
        identical(sapply(1:2,function(i)numeric(),simplify=NA),list(numeric(),numeric())),
        identical(sapply(1:2,function(i)c(i,i+1L),simplify=NA),matrix(c(1L,2L,2L,3L),2)),
        identical(capture(sapply(1:2,f,simplify=NA)),"missing value where TRUE/FALSE needed"),
        identical(capture(sapply(1:2,f,simplify=c(TRUE,FALSE))),"'length = 2' in coercion to 'logical(1)'"),
        identical(capture(sapply(1:2,f,simplify=pairlist("array"))),"comparison (==) is possible only for atomic and list types"),
        identical(sapply(1:2,f,simplify=),flat))
    })`),
    ).toEqual(Array(19).fill(true));
  } finally {
    await r.dispose();
  }
});

it("uses short-circuit names controls while retaining names and forcing controls in order", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      capture<-function(expr)tryCatch(expr,error=conditionMessage)
      seen<-character()
      bytes<-rawToChar(as.raw(233));Encoding(bytes)<-"latin1"
      encoded<-sapply(c(bytes,NA_character_),identity)
      f<-function(i){seen<<-c(seen,paste0("FUN",i));i}
      forced<-sapply(1:2,f,USE.NAMES={seen<-c(seen,"NAMES");NA},simplify={seen<-c(seen,"SIMPLIFY");FALSE})
      c(identical(sapply(1:2,identity,USE.NAMES=NA),1:2),
        identical(sapply(c(a="x",b="y"),identity,USE.NAMES=NA),c(a="x",b="y")),
        identical(sapply(1:2,identity,USE.NAMES=logical()),1:2),
        identical(sapply(1:2,identity,USE.NAMES=NA_complex_),1:2),
        identical(capture(sapply(c("x","y"),identity,USE.NAMES=NA)),"missing value where TRUE/FALSE needed"),
        identical(capture(sapply(c("x","y"),identity,USE.NAMES=logical())),"missing value where TRUE/FALSE needed"),
        identical(capture(sapply(1:2,identity,USE.NAMES=NULL)),"invalid 'x' type in 'x && y'"),
        identical(capture(sapply(1:2,identity,USE.NAMES="TRUE")),"invalid 'x' type in 'x && y'"),
        identical(capture(sapply(1:2,identity,USE.NAMES=as.raw(1))),"invalid 'x' type in 'x && y'"),
        identical(capture(sapply(1:2,identity,USE.NAMES=c(TRUE,FALSE))),"'length = 2' in coercion to 'logical(1)'"),
        identical(sapply(c(a=1L,b=2L),identity,USE.NAMES=FALSE),c(a=1L,b=2L)),
        identical(names(sapply(c(NA_character_,"x"),identity)),c(NA_character_,"x")),
        identical(sapply(c("x","y"),identity,USE.NAMES=1+0i),c(x="x",y="y")),
        identical(sapply(c("x","y"),identity,USE.NAMES=0+0i),c("x","y")),
        identical(sapply(c("x","y"),identity,USE.NAMES=,simplify=),c(x="x",y="y")),
        identical(seen,c("FUN1","FUN2","NAMES","SIMPLIFY")),
        identical(forced,list(1L,2L)),
        identical(capture(sapply(integer(),identity,simplify=stop("simplify forced"))),"simplify forced"),
        identical(Encoding(names(encoded)),c("latin1","unknown")),
        identical(charToRaw(names(encoded)[1]),as.raw(233)))
    })`),
    ).toEqual(Array(20).fill(true));
  } finally {
    await r.dispose();
  }
});

it("compares higher controls only when needed using globally visible operator methods", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      seen<-0L
      \`==.arraymode\`<-function(e1,e2){seen<<-seen+1L;identical(.Generic,"==")&&identical(.Group,"")}
      Ops.opsmode<-function(e1,e2)identical(.Generic,"==")&&identical(.Group,"Ops")
      f<-function(i)matrix(1:4+i,2)
      mode<-structure("matrix",class="arraymode")
      a<-sapply(1:2,f,simplify=mode)
      b<-sapply(1:2,identity,simplify=mode)
      d<-sapply(1:2,f,simplify=structure(FALSE,class="arraymode"))
      e<-sapply(1:2,f,simplify=structure("matrix",class="opsmode"))
      as.list.shortinput<-function(x,...)list(1L)
      as.list.longinput<-function(x,...)list(1L,2L,3L)
      short<-structure(c("a","b"),class="shortinput")
      long<-structure(c("a","b"),class="longinput")
      localResult<-local({\`==.localmode\`<-function(e1,e2)stop("unused local method");sapply(1:2,f,simplify=structure("matrix",class="localmode"))})
      c(identical(dim(a),c(2L,2L,2L)),identical(b,1:2),
        identical(d,list(f(1L),f(2L))),seen==1L,
        identical(dim(e),c(2L,2L,2L)),identical(dim(localResult),c(4L,2L)),
        identical(tryCatch(sapply(short,identity),error=conditionMessage),"'names' attribute [2] must be the same length as the vector [1]"),
        identical(sapply(short,identity,USE.NAMES=FALSE),1L),
        identical(names(sapply(long,identity)),c("a","b",NA_character_)))
    `),
    ).toEqual(Array(9).fill(true));
  } finally {
    await r.dispose();
  }
});
