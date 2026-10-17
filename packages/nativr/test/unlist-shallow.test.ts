import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("selects shallow unlist storage from input types and preserves list cells", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      c(identical(unlist(list(a=1:2,b=3:4),recursive=FALSE),c(a1=1L,a2=2L,b1=3L,b2=4L)),
        identical(unlist(list(a=list(k=structure(1,tag="cell")),b=2),recursive=FALSE),list(a.k=structure(1,tag="cell"),b=2)),
        identical(unlist(list(a=list(NULL),b=list(NULL)),recursive=FALSE),list(a=NULL,b=NULL)),
        identical(unlist(list(integer(),double()),recursive=FALSE),double()),
        identical(unlist(list(list(),NULL),recursive=FALSE),list()),
        identical(unlist(list(expression(a,1+2),3),recursive=FALSE,use.names=FALSE),expression(a,1+2,3)),
        identical(unlist(list(expression(),integer()),recursive=FALSE),expression()),
        identical(unlist(quote(f(a=1)),use.names=FALSE),quote(f(a=1))),
        identical(unlist(c(a=1),use.names=FALSE),c(a=1)))
    `),
    ).toEqual([true, true, true, true, true, true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("composes shallow names including blank and missing names", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      c(identical(names(unlist(structure(list(1,1:2),names=c(NA,NA)),recursive=FALSE)),c(NA,"NA1","NA2")),
        identical(names(unlist(structure(list(setNames(1,NA_character_),c(inner=2)),names=c(NA,"")),recursive=FALSE)),c("NA.NA","inner")),
        identical(names(unlist(list(a=list(k=1,2),b=list(3,4)),recursive=FALSE)),c("a.k","a2","b1","b2")),
        identical(names(unlist(structure(list(1,2),names=c("","")),recursive=FALSE)),c("","")),
        is.null(names(unlist(list(a=list(k=1),b=c(inner=2)),recursive=FALSE,use.names=FALSE))))
    `),
    ).toEqual([true, true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("merges shallow factors only when all inputs are factors and drops ordered classes", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      a<-ordered(c("y",NA),levels=c("x","y"))
      b<-ordered("z",levels=c("z","x"))
      value<-unlist(list(a=a,b=b),recursive=FALSE)
      c(identical(as.integer(value),c(2L,NA_integer_,3L)),
        identical(levels(value),c("x","y","z")),
        identical(class(value),"factor"),
        identical(names(value),c("a1","a2","b")),
        identical(names(attributes(value)),c("levels","names","class")),
        identical(unlist(list(a=factor("y",levels=c("x","y")),b=NULL),recursive=FALSE),c(a=2L)),
        identical(unlist(list(a=factor("y",levels=c("x","y")),b=integer()),recursive=FALSE),c(a=2L)),
        is.null(names(unlist(list(a=setNames(a,c("u","v")),b=b),recursive=FALSE,use.names=FALSE))),
        identical(levels(unlist(list(factor(character(),levels=c("a","b")),factor(character(),levels=c("b","c"))),recursive=FALSE)),c("a","b","c")),
        identical(unlist(list(a=list(a),b=list(b))),value),
        identical(unlist(list(a=factor("y",levels=c("x","y")),b=NULL)),c(a=2L)))
    `),
    ).toEqual([true, true, true, true, true, true, true, true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("checks the flattened allocation before materializing shallow output", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1000 } });
  try {
    await expect(r.eval("x<-1:600; unlist(list(a=x,b=x),recursive=FALSE)")).rejects.toMatchObject({
      code: "NRL4002",
    });
  } finally {
    await r.dispose();
  }
});

it("retains inherited name bytes and translates composed names to UTF-8", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`
      latin<-rawToChar(as.raw(233));Encoding(latin)<-"latin1"
      bytes<-rawToChar(as.raw(233));Encoding(bytes)<-"bytes"
      direct<-names(unlist(setNames(list(1,2),c(latin,NA_character_)),recursive=FALSE))
      inner<-names(unlist(list(setNames(1,latin)),recursive=FALSE))
      composed<-names(unlist(setNames(list(c(x=1)),latin),recursive=FALSE))
      indexed<-names(unlist(setNames(list(1:2),latin),recursive=FALSE))
      byteName<-names(unlist(list(setNames(1,bytes)),recursive=FALSE))
      failure<-tryCatch(unlist(setNames(list(1:2),bytes),recursive=FALSE),error=conditionMessage)
      c(identical(Encoding(direct),c("latin1","unknown")),
        identical(charToRaw(direct[1]),as.raw(233)),
        identical(Encoding(inner),"latin1"),identical(charToRaw(inner),as.raw(233)),
        identical(Encoding(composed),"UTF-8"),identical(charToRaw(composed),as.raw(c(195,169,46,120))),
        identical(Encoding(indexed),c("UTF-8","UTF-8")),identical(charToRaw(indexed[1]),as.raw(c(195,169,49))),
        identical(Encoding(byteName),"bytes"),identical(charToRaw(byteName),as.raw(233)),
        identical(failure,'translating strings with "bytes" encoding is not allowed'))
    `),
    ).toEqual(Array(11).fill(true));
  } finally {
    await r.dispose();
  }
});

it("accounts for repeated factor-level scans even when output factors are empty", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000, maxVectorLength: 1000 },
  });
  try {
    await r.eval('f<-structure(integer(),levels=as.character(1:200),class="factor")');
    await expect(
      r.eval("unlist(rep(list(f),50),recursive=FALSE,use.names=FALSE)"),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await r.eval("length(levels(f))")).toBe(200);
  } finally {
    await r.dispose();
  }
});

it("bounds the unique factor-level union independently of output length", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1000 } });
  try {
    await r.eval(
      'a<-structure(integer(),levels=as.character(1:600),class="factor");b<-structure(integer(),levels=as.character(601:1200),class="factor")',
    );
    await expect(r.eval("unlist(list(a,b),recursive=FALSE)")).rejects.toMatchObject({
      code: "NRL4002",
      details: { maxVectorLength: 1000, requested: 1001 },
    });
  } finally {
    await r.dispose();
  }
});
