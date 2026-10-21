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

// Independently authored fixtures, checked against GNU R only as a black-box oracle.
const cases = [
  [
    "source contains each expression return",
    `identical(source(exprs=expression(return(7L),return(9L)),local=new.env()),list(value=9L,visible=TRUE))`,
  ],
  [
    "source stops the current block but continues the next expression",
    `identical(source(exprs=expression({return(7L);stop("unreachable")},9L),local=new.env())$value,9L)`,
  ],
  [
    "source preserves invisible return",
    `identical(source(exprs=expression(return(invisible(7L))),local=new.env()),list(value=7L,visible=FALSE))`,
  ],
  [
    "source empty return is visible NULL",
    `identical(source(exprs=expression(return()),local=new.env()),list(value=NULL,visible=TRUE))`,
  ],
  [
    "source itself remains invisible",
    `identical(withVisible(source(exprs=expression(return(7L)),local=new.env()))$visible,FALSE)`,
  ],
  [
    "source local TRUE contains return",
    `f<-function(){source(exprs=expression(return(7L)),local=TRUE);9L};identical(f(),9L)`,
  ],
  [
    "source local FALSE contains return",
    `f<-function(){source(exprs=expression(return(7L)),local=FALSE);9L};identical(f(),9L)`,
  ],
  [
    "source connection uses the same expression scopes",
    `con<-textConnection("return(7L)\n9L");on.exit(close(con));identical(source(con,local=new.env())$value,9L)`,
  ],
  [
    "source cleanup runs before the next expression",
    `events<-character();source(exprs=expression(on.exit(events<-c(events,"exit")),events<-c(events,"after")),local=TRUE);identical(events,c("exit","after"))`,
  ],
  [
    "source cleanup stays separate from owner cleanup",
    `e<-new.env();e$events<-character();f<-function(){on.exit(e$events<-c(e$events,"owner"));source(exprs=expression(on.exit(e$events<-c(e$events,"source"))),local=TRUE);e$events<-c(e$events,"after")};f();identical(e$events,c("source","after","owner"))`,
  ],
  [
    "source exit return replaces the expression result",
    `identical(source(exprs=expression({on.exit(return(invisible(9L)));7L}),local=new.env()),list(value=9L,visible=FALSE))`,
  ],
  [
    "source error runs cleanup and stops later expressions",
    `e<-new.env();e$events<-character();message<-tryCatch(source(exprs=expression({on.exit(e$events<-c(e$events,"exit"));stop("body")},e$events<-c(e$events,"unreachable")),local=TRUE),error=conditionMessage);identical(message,"body")&&identical(e$events,"exit")`,
  ],
  [
    "source preserves result identity and attributes",
    `e<-new.env();object<-new.env();attr(object,"owned")<-7L;e$object<-object;result<-source(exprs=expression(return(object)),local=e)$value;identical(result,object)&&identical(attr(result,"owned"),7L)`,
  ],
  [
    "source return keeps earlier environment mutations",
    `e<-new.env();source(exprs=expression({x<-1L;return(7L);x<-2L},y<-3L),local=e);identical(e$x,1L)&&identical(e$y,3L)`,
  ],
  [
    "data frame predicate contains return",
    `f<-function(){subset(data.frame(a=1:3),return(c(TRUE,FALSE,TRUE)));9L};identical(f(),9L)`,
  ],
  [
    "data frame returned predicate selects rows",
    `identical(subset(data.frame(a=1:3),return(c(TRUE,FALSE,TRUE)))$a,c(1L,3L))`,
  ],
  [
    "data frame select contains return",
    `f<-function(){subset(data.frame(a=1:3,b=2:4),select=return(1L));9L};identical(f(),9L)`,
  ],
  [
    "matrix select contains return",
    `f<-function(){subset(matrix(1:6,3),select=return(1L));9L};identical(f(),9L)`,
  ],
  [
    "matrix returned selection retains dimensions",
    `x<-matrix(1:6,3,dimnames=list(NULL,c("a","b")));identical(subset(x,select=return(b)),x[,2,drop=FALSE])`,
  ],
  [
    "matrix predicate return reaches its owner",
    `f<-function(){subset(matrix(1:6,3),return(c(TRUE,FALSE,TRUE)));9L};identical(f(),c(TRUE,FALSE,TRUE))`,
  ],
  [
    "atomic predicate return reaches its owner",
    `f<-function(){subset(1:3,return(c(TRUE,FALSE,TRUE)));9L};identical(f(),c(TRUE,FALSE,TRUE))`,
  ],
  [
    "forwarded predicate return reaches its original owner",
    `g<-function(p)subset(data.frame(a=1:3),p);f<-function(){g(return(c(TRUE,FALSE,TRUE)));9L};identical(f(),c(TRUE,FALSE,TRUE))`,
  ],
  [
    "subset predicate and selection have separate cleanup",
    `e<-new.env();e$events<-character();subset(data.frame(a=1:3),{on.exit(e$events<-c(e$events,"predicate.exit"));a>1},select={e$events<-c(e$events,"select");on.exit(e$events<-c(e$events,"select.exit"));a});e$events<-c(e$events,"after");identical(e$events,c("predicate.exit","select","select.exit","after"))`,
  ],
  [
    "matrix predicate cleanup belongs to owner",
    `e<-new.env();e$events<-character();f<-function(){subset(matrix(1:6,3),{on.exit(e$events<-c(e$events,"exit"));c(TRUE,FALSE,TRUE)});e$events<-c(e$events,"after")};f();identical(e$events,c("after","exit"))`,
  ],
  [
    "matrix select cleanup runs immediately",
    `e<-new.env();e$events<-character();subset(matrix(1:6,3),select={on.exit(e$events<-c(e$events,"exit"));1L});e$events<-c(e$events,"after");identical(e$events,c("exit","after"))`,
  ],
  [
    "subset predicate cleanup can replace its value",
    `identical(subset(data.frame(a=1:3),{on.exit(return(c(TRUE,FALSE,TRUE)));rep(FALSE,3)})$a,c(1L,3L))`,
  ],
  [
    "subset ordinary error still runs mask cleanup",
    `e<-new.env();e$events<-character();message<-tryCatch(subset(data.frame(a=1:3),{on.exit(e$events<-c(e$events,"exit"));stop("predicate")}),error=conditionMessage);identical(message,"predicate")&&identical(e$events,"exit")`,
  ],
  [
    "masked predicates reject an outer loop",
    `message<-tryCatch({for(i in 1:3)subset(data.frame(a=1:3),break)},error=conditionMessage);identical(message,"no loop for break/next, jumping to top level")`,
  ],
  [
    "matrix predicates reach their original loop",
    `count<-0L;for(i in 1:3){subset(matrix(1:6,3),break);count<-count+1L};identical(count,0L)`,
  ],
  [
    "source in reused environment reaches its loop",
    `count<-0L;for(i in 1:3){source(exprs=expression(break),local=TRUE);count<-count+1L};identical(count,0L)`,
  ],
  [
    "source in separate environment rejects outer loop",
    `message<-tryCatch({for(i in 1:3)source(exprs=expression(break),local=new.env())},error=conditionMessage);identical(message,"no loop for break/next, jumping to top level")`,
  ],
  [
    "plain list predicate uses caller bindings",
    `a<-c(TRUE,FALSE);identical(subset(list(a=7L,b=9L),a),list(a=7L))`,
  ],
  [
    "plain list predicate cleanup belongs to owner",
    `e<-new.env();e$events<-character();f<-function(){subset(list(a=7L,b=9L),{on.exit(e$events<-c(e$events,"exit"));c(TRUE,FALSE)});e$events<-c(e$events,"after")};f();identical(e$events,c("after","exit"))`,
  ],
] as const;

it.each(cases)("%s", async (_name, code) => {
  const result = await runtime.evalDetailed(`(function(){${code}})()`);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
});

it.each([
  "source(exprs=expression({on.exit(return(9L));repeat {1L}}),local=new.env())",
  "subset(data.frame(a=1:3),{on.exit(return(rep(TRUE,3)));repeat {1L}})",
])("restores execution after adapter resource exhaustion: %s", async (code) => {
  const limited = await createR({ execution: "inline", assets, limits: { maxSteps: 1000 } });
  try {
    await expect(limited.eval(code)).rejects.toMatchObject({ code: "NRL4001" });
    expect(await limited.eval("source(exprs=expression(return(7L)),local=new.env())$value")).toBe(
      7,
    );
    expect(await limited.eval("sys.nframe()")).toBe(0);
  } finally {
    await limited.dispose();
  }
});
