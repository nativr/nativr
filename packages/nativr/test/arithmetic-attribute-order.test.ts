import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations of names order and unchanged source metadata.
// Dimensional attribute order and conflicting array-attribute precedence remain separate gaps.
const cases = [
  [
    "double unequal length arithmetic preserves values and reference attrs",
    'local({e<-new.env();x<-structure(c(a=0,b=1.25),note=e);a<-10+x;b<-x+10;identical(as.numeric(a),c(10,11.25))&&identical(a,b)&&identical(names(attributes(a)),c("note","names"))&&identical(names(attributes(x)),c("names","note"))&&identical(attr(a,"note"),e)})',
  ],
  [
    "integer unequal length arithmetic preserves storage and reference attrs",
    'local({e<-new.env();x<-structure(c(a=0L,b=1L),note=e);a<-10L+x;b<-x+10L;identical(as.integer(a),c(10L,11L))&&identical(a,b)&&identical(names(attributes(a)),c("note","names"))&&identical(names(attributes(x)),c("names","note"))&&identical(attr(a,"note"),e)})',
  ],
  [
    "equal length arithmetic merges right then left ordinary attrs",
    'local({l<-structure(c(a=1,b=2),note="left",left=1L);r<-structure(c(c=3,d=4),note="right",right=2L);a<-l+r;identical(as.numeric(a),c(4,6))&&identical(names(attributes(a)),c("note","right","left","names"))&&identical(attr(a,"note"),"left")&&identical(names(a),c("a","b"))&&identical(names(attributes(l)),c("names","note","left"))&&identical(names(attributes(r)),c("names","note","right"))})',
  ],
  [
    "scalar arithmetic relocates names after ordinary attributes",
    'local({x<-structure(1L,names="a",note="keep");y<-0L+x;identical(typeof(y),"integer")&&identical(names(attributes(y)),c("note","names"))&&identical(names(y),"a")&&identical(attr(y,"note"),"keep")&&identical(names(attributes(x)),c("names","note"))})',
  ],
  [
    "logical arithmetic relocates names after ordinary attributes",
    'local({x<-structure(c(a=TRUE,b=FALSE),note="keep");y<-x+1L;identical(typeof(y),"integer")&&identical(as.integer(y),c(2L,1L))&&identical(names(attributes(y)),c("note","names"))&&identical(names(y),c("a","b"))&&identical(attr(y,"note"),"keep")&&identical(names(attributes(x)),c("names","note"))})',
  ],
  [
    "complex arithmetic relocates names after ordinary attributes",
    'local({x<-structure(c(a=1+2i,b=3-4i),note="keep");y<-x+2;identical(as.numeric(Re(y)),c(3,5))&&identical(as.numeric(Im(y)),c(2,-4))&&identical(typeof(y),"complex")&&identical(names(attributes(y)),c("note","names"))&&identical(names(y),c("a","b"))&&identical(attr(y,"note"),"keep")&&identical(names(attributes(x)),c("names","note"))})',
  ],
  [
    "dimensioned arithmetic preserves dimensions and suppresses names",
    'local({x<-structure(matrix(c(0,1),1,dimnames=list("r",c("a","b"))),names=c("x","y"),note="keep");y<-10+x;identical(dim(y),c(1L,2L))&&identical(dimnames(y),list("r",c("a","b")))&&is.null(names(y))&&identical(attr(y,"note"),"keep")&&identical(as.numeric(y),c(10,11))&&identical(names(x),c("x","y"))})',
  ],
  [
    "dimensioned equal length arithmetic suppresses competing vector names",
    'local({x<-structure(matrix(c(0,1),1,dimnames=list("r",c("a","b"))),note="right");y<-structure(c(10,20),names=c("x","y"),note="left");z<-y+x;identical(dim(z),c(1L,2L))&&identical(dimnames(z),list("r",c("a","b")))&&is.null(names(z))&&identical(as.numeric(z),c(10,21))&&identical(names(y),c("x","y"))})',
  ],
] as const;

it.each(cases)("arithmetic attribute order: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
