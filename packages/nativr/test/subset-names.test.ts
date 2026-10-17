import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
it("retains missing names through shared vector selection", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-setNames(1:3,c("a",NA,""));c(identical(names(x[c(3,NA,1,5)]),c("",NA,"a",NA)),identical(x[""],setNames(NA_integer_,NA_character_)),identical(names(x[c(2,1,2)]),c(NA,"a",NA)))})',
      ),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("retains missing axis names through dimensional selection", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-matrix(1:6,3,dimnames=list(c("a",NA,""),c(NA,"b")));c(identical(names(x[,1]),c("a",NA,"")),identical(rownames(x[c(2,NA,1),,drop=FALSE]),c(NA,NA,"a")),identical(colnames(x[1,,drop=FALSE]),c(NA,"b")))})',
      ),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("retains missing names during replacement, extension, and deletion", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-structure(list(1,2,3),names=c("a",NA,""));y<-x;y[[1]]<-NULL;z<-x;z[5]<-9;c(identical(names(y),c(NA,"")),identical(names(z),c("a",NA,"","","")))})',
      ),
    ).toEqual([true, true]);
  } finally {
    await r.dispose();
  }
});

it("appends distinct NA names for missing character replacement indices", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-1:2;x[c(NA_character_,NA_character_)]<-8:9;y<-list(a=1);y[[NA_character_]]<-9;c(identical(names(x),c("","",NA,NA)),identical(unname(x),c(1L,2L,8L,9L)),identical(names(y),c("a",NA)))})',
      ),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("distinguishes missing-name matching for single extraction and dollar", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-structure(list(1,2,3),names=c(NA,"NA",""));c(is.null(x[[NA_character_]]),is.null(x[[""]]),identical(x[["NA"]],2),identical(x$`NA`,1),is.null(x$N),is.null(x[[NA_integer_]]))})',
      ),
    ).toEqual([true, true, true, true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("routes callable dollar through syntax extraction and S3 dispatch", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-list(a=1);e<-new.env();e$a<-2;`$.fixture`<-function(x,name)paste0("method:",name);list(do.call("$",list(x,"a")),do.call("$",list(e,"a")),get("$")(quote(f(a=3)),a),do.call("$",list(structure(x,class="fixture"),"a")),get("$")(x,a),typeof(get("$")),formals(get("$")))})',
      ),
    ).toEqual([1, 2, 3, "method:a", 1, "special", null]);
  } finally {
    await r.dispose();
  }
});
