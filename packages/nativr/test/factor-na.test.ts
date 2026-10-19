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

// Owned observations against GNU R 4.6.1. NA levels and missing codes are separate.
const input = 'x<-structure(c(1L,2L,3L,NA_integer_),levels=c("",NA,"a"),class="factor");';
const cases = [
  [
    "constructs missing levels without confusing blank labels",
    'y<-factor(c("",NA,"a"),exclude=NULL);identical(levels(y),c("","a",NA))&&identical(as.integer(y),c(1L,3L,2L))&&!any(is.na(y))',
  ],
  [
    "keeps NA distinct from NaN and honors exclusions",
    'y<-factor(c(1,NaN,NA),exclude=NaN);identical(levels(y),c("1",NA))&&identical(as.integer(y),c(1L,NA_integer_,2L))',
  ],
  [
    "merges labels and preserves an NA label",
    'y<-factor(c("a","b","c"),labels=c("x","x",NA));identical(levels(y),c("x",NA))&&identical(as.integer(y),c(1L,1L,2L))',
  ],
  [
    "supports scalar prefixes and labels on empty factors",
    'identical(levels(factor(letters[1:3],labels=NA)),c("NA1","NA2","NA3"))&&identical(levels(factor(character(),labels="owned")),"owned")',
  ],
  [
    "uses first explicit duplicate level when labels are supplied",
    'y<-factor(c("a","b"),levels=c("a","a","b"),labels=c("x","y","z"));identical(as.integer(y),c(1L,3L))&&identical(levels(y),c("x","y","z"))',
  ],
  [
    "keeps names and drops unrelated attributes on reconstruction",
    'y<-factor(setNames(c("a",NA),c(NA,"b")),exclude=NULL);identical(names(y),c(NA,"b"))&&identical(names(attributes(y)),c("names","levels","class"))',
  ],
  [
    "adds NA once and retains unused levels and order",
    'y<-addNA(ordered(c("b",NA),levels=c("a","b","unused")));identical(levels(y),c("a","b","unused",NA))&&identical(as.integer(y),c(2L,4L))&&is.ordered(y)&&!any(is.na(y))',
  ],
  [
    "preserves unchanged values and rebuilds changed values",
    'y<-factor("a");attr(y,"owned")<-7;z<-addNA(y,ifany=TRUE);w<-addNA(y);identical(z,y)&&is.null(attr(w,"owned"))&&identical(levels(w),c("a",NA))',
  ],
  [
    "adds a level to empty factors only when requested",
    'identical(levels(addNA(NULL)),NA_character_)&&identical(addNA(factor(),ifany=TRUE),factor())&&is.factor(addNA("a",ifany=TRUE))',
  ],
  [
    "returns an unchanged existing NA-level factor",
    'y<-x[1:3];attr(y,"owned")<-7;identical(addNA(y),y)&&identical(as.integer(addNA(x)),c(1L,2L,3L,2L))',
  ],
  [
    "keeps coercion and code missingness distinct",
    'identical(as.character(x),c("",NA,"a",NA))&&identical(as.vector(x),c("",NA,"a",NA))&&identical(is.na(x),c(FALSE,FALSE,FALSE,TRUE))',
  ],
  [
    "refactors NA levels with the selected exclusion policy",
    'identical(levels(factor(x)),c("","a"))&&identical(as.integer(factor(x)),c(1L,NA_integer_,2L,NA_integer_))&&identical(as.integer(factor(x,exclude=NULL)),c(1L,2L,3L,2L))',
  ],
  [
    "converts unordered factors without recursive dispatch",
    'y<-as.ordered(x);identical(levels(y),c("","a"))&&identical(as.integer(y),c(1L,NA_integer_,2L,NA_integer_))&&identical(as.factor(x),x)',
  ],
  [
    "combines factor levels and recodes missing codes",
    'expected<-structure(c(1L,2L,3L,2L,1L,2L,3L,2L),levels=levels(x),class="factor");identical(c(x,x),expected)&&identical(append(x,x),expected)&&identical(unlist(list(x,x)),expected)',
  ],
  [
    "matches labels but keeps code distinctions in unique",
    'identical(match(x,x),c(1L,2L,3L,2L))&&identical(match(x,c("",NA,"a")),c(1L,2L,3L,2L))&&identical(as.integer(unique(x)),as.integer(x))&&identical(duplicated(x),rep(FALSE,4))',
  ],
  [
    "compares missing levels separately from empty and NA strings",
    'identical(x==x,c(TRUE,TRUE,TRUE,NA))&&identical(x=="",c(TRUE,FALSE,FALSE,NA))&&identical(x=="NA",c(FALSE,FALSE,FALSE,NA))',
  ],
  [
    "replaces NA with an existing NA level",
    "y<-x;y[1]<-NA;y[3]<-x[2];identical(as.integer(y),c(2L,2L,2L,NA_integer_))&&identical(levels(y),levels(x))",
  ],
  [
    "retains NA labels in grouped results",
    'y<-split(seq_along(x),x);identical(names(y),c("",NA,"a"))&&identical(unname(y),list(1L,2L,3L))&&identical(as.vector(tapply(1:4,x,sum)),1:3)',
  ],
  [
    "counts factor levels independently of missing codes",
    'y<-table(x);z<-table(x,useNA="ifany");identical(as.integer(y),c(1L,1L,1L))&&identical(as.integer(z),c(1L,2L,1L))&&identical(dimnames(z)[[1]],levels(x))',
  ],
  [
    "does not collide NA with a literal display label",
    'y<-table(c("<NA>",NA,""),useNA="always");identical(as.integer(y),c(1L,1L,1L))&&identical(dimnames(y)[[1]],c("","<NA>",NA))',
  ],
  [
    "excludes specified levels while retaining unused levels",
    'y<-table(x,exclude="a");identical(as.integer(y),c(1L,2L))&&identical(dimnames(y)[[1]],c("",NA))&&identical(as.integer(table(x,exclude=NULL,useNA="no")),c(1L,1L,1L))',
  ],
  [
    "coerces factor matrices and paste through labels",
    'identical(as.vector(as.matrix(data.frame(value=x))),c("",NA,"a",NA))&&identical(paste(x),c("","NA","a","NA"))',
  ],
  [
    "drops NA levels in ordered reductions and reorder results",
    'y<-x;class(y)<-c("ordered","factor");identical(levels(range(y[1:3])),c("","a"))&&identical(as.integer(range(y[1:3])),1:2)&&identical(as.integer(reorder(x,1:4)),c(1L,NA_integer_,2L,NA_integer_))',
  ],
  [
    "preserves set operation code distinctions",
    "identical(as.integer(setdiff(x,x[1])),c(2L,3L,NA_integer_))&&identical(as.integer(union(x,x[2:4])),c(1L,2L,3L,2L))&&identical(as.integer(intersect(x,x[2:4])),c(2L,3L,2L))",
  ],
  [
    "encodes NA levels as model categories",
    'm<-model.matrix(~x,data.frame(x=x));identical(colnames(m),c("(Intercept)","xNA","xa"))&&identical(as.vector(m),c(1,1,1,0,1,0,0,0,1))',
  ],
  [
    "exposes observed factor defaults and addNA signature",
    "identical(formals(addNA),formals(function(x,ifany=FALSE)NULL))&&identical(formals(factor),formals(function(x=character(),levels,labels=levels,exclude=NA,ordered=is.ordered(x),nmax=NA)NULL))&&identical(formals(ordered),formals(function(x=character(),...)NULL))",
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`local({${input}${code}})`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it("reports invalid levels and controls without S3 recursion", async () => {
  await expect(runtime.eval('factor("a",levels=c("a","a"))')).rejects.toThrow(
    "factor level [2] is duplicated",
  );
  await expect(runtime.eval('addNA("a",ifany=NA)')).rejects.toThrow(
    "missing value where TRUE/FALSE needed",
  );
  await expect(runtime.eval('ordered("a",ordered=FALSE)')).rejects.toThrow(
    'formal argument "ordered" matched by multiple actual arguments',
  );
  await expect(
    runtime.eval(`local({${input}class(x)<-c("ordered","factor");x<x})`),
  ).rejects.toThrow("missing value where TRUE/FALSE needed");
  const contradictory = await runtime.evalDetailed(
    `local({${input}as.integer(table(x,exclude=NA,useNA="always"))})`,
  );
  expect(contradictory.value).toEqual([1, 1]);
  expect(contradictory.warnings.map((warning) => warning.message)).toEqual([
    "'exclude' containing NA and 'useNA' != \"no\"' are a bit contradicting",
  ]);
});

it("retains NA axes in xtabs and recodes factor data-frame rows", async () => {
  expect(
    await runtime.eval(
      `local({${input}a<-xtabs(~x);b<-xtabs(~x,addNA=TRUE);c<-xtabs(~x,exclude=NA);r<-rbind(data.frame(x=x),data.frame(x=x));c(identical(as.integer(a),c(1L,1L,1L)),identical(dimnames(a)[[1]],levels(x)),identical(as.integer(b),c(1L,2L,1L)),identical(as.integer(c),c(1L,1L)),identical(as.integer(r$x),rep(c(1L,2L,3L,2L),2)))})`,
    ),
  ).toEqual([true, true, true, true, true]);
});

it("bounds factor reconstruction even when most levels are unused", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxSteps: 1000 } });
  try {
    await limited.assign(
      "ownedLevels",
      Array.from({ length: 2000 }, (_, index) => String(index)),
    );
    await expect(
      limited.eval('addNA(structure(integer(),levels=ownedLevels,class="factor"))'),
    ).rejects.toMatchObject({ code: "NRL4001" });
  } finally {
    await limited.dispose();
  }
});

it("applies three-valued short-circuit semantics to ifany controls", async () => {
  for (const control of ["NA", "NA_real_", "NaN", "logical()", "NA_complex_"]) {
    expect(await runtime.eval(`identical(as.integer(addNA(c("a",NA),ifany=${control})),1:2)`)).toBe(
      true,
    );
    await expect(runtime.eval(`addNA("a",ifany=${control})`)).rejects.toThrow(
      "missing value where TRUE/FALSE needed",
    );
  }
  for (const control of ["NULL", '"TRUE"', "NA_character_", "as.raw(1)", "list(TRUE)"]) {
    await expect(runtime.eval(`addNA(c("a",NA),ifany=${control})`)).rejects.toThrow(
      "invalid 'x' type in 'x && y'",
    );
  }
  await expect(runtime.eval('addNA(c("a",NA),ifany=c(TRUE,FALSE))')).rejects.toThrow(
    "'length = 2' in coercion to 'logical(1)'",
  );
  expect(await runtime.eval('identical(addNA("a",ifany=),addNA("a"))')).toBe(true);
});
