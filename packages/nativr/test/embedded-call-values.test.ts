import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independently authored probes of GNU R 4.6.1's observable call storage and evaluation.
it("retains embedded closures, builtins, environments and lexical capture", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      offset <- 10
      f <- function(x) x + offset
      attr(f, "note") <- "owned"
      cl <- as.call(list(f, 2))
      offset <- 20
      e <- new.env(parent=emptyenv()); e$self <- e
      arg <- call("identity", f)
      env <- call("identity", e)
      builtin <- as.call(list(sum, 1, 2))
      c(identical(cl[[1L]], f), identical(eval(cl), 22),
        identical(eval(arg), f), identical(attr(arg[[2L]], "note"), "owned"),
        identical(eval(env), e), identical(eval(env)$self, e),
        identical(builtin[[1L]], sum), identical(eval(builtin), 3),
        identical(do.call(function(g) g(3), list(f)), 23),
        identical(eval(bquote(.(f)(4))), 24))
    })`),
    ).toEqual(Array(10).fill(true));
  } finally {
    await r.dispose();
  }
});

it("preserves arbitrary call heads and rejects non-functions only on evaluation", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      heads <- list("sum", c("sum", "other"), character(), "", NA_character_,
                    1, NULL, list(1), new.env(parent=emptyenv()))
      seen <- FALSE
      results <- vapply(heads, function(head) {
        cl <- as.call(list(head, quote({seen <<- TRUE; 2})))
        identical(cl[[1L]], head) && tryCatch({eval(cl); FALSE}, error=function(e) TRUE)
      }, logical(1))
      c(results, !seen,
        identical(as.call(expression("sum", 2))[[1L]], "sum"),
        identical(eval(as.call(list(as.name("sum"), 2))), 2),
        identical(deparse(as.call(list("sum", 2))), '"sum"(2)'))
    })`),
    ).toEqual(Array(13).fill(true));
    await expect(r.eval('eval(as.call(list("sum", 2)))')).rejects.toMatchObject({
      code: "NRT3002",
    });
    await expect(r.eval("as.call(list())")).rejects.toMatchObject({ code: "NRT3208" });
  } finally {
    await r.dispose();
  }
});

it("deparses owned closure values in call heads and arguments", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(await r.eval("deparse(as.call(list(function(x) x + 1, 5)))")).toEqual([
      "(function (x) ",
      "x + 1)(5)",
    ]);
    expect(await r.eval('deparse(call("f", function(x) x + 1))')).toEqual([
      "f(function (x) ",
      "x + 1)",
    ]);
    expect(await r.eval("deparse(as.call(list(sum, 1, 2)))")).toBe('.Primitive("sum")(1, 2)');
    expect(
      await r.eval('local({f<-function(x)x+1;attr(f,"note")<-"owned";deparse(call("f",f))})'),
    ).toEqual(["f(structure(function (x) ", 'x + 1, note = "owned"))']);
    expect(
      await r.eval(
        'local({f<-function(x)x+1;attr(f,"note")<-"owned";deparse(as.call(list(f,2)))})',
      ),
    ).toEqual(["(structure(function (x) ", 'x + 1, note = "owned"))(2)']);
    expect(
      await r.eval(`local({
      seen <- character()
      f <- function() {
        thunk <- function() seen <<- c(seen, "exit")
        do.call(on.exit, list(as.call(list(thunk)), TRUE, FALSE))
        seen <<- c(seen, "body")
        7
      }
      value <- f()
      c(seen, value)
    })`),
    ).toEqual(["body", "exit", "7"]);
  } finally {
    await r.dispose();
  }
});

it("coerces factors without dispatch or generic recursion and exposes x formals", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({
      as.factor <- function(x, ...) UseMethod("as.factor")
      as.factor.default <- function(x, ...) base::as.factor(x)
      as.ordered <- function(x, ...) UseMethod("as.ordered")
      as.ordered.default <- function(x, ...) base::as.ordered(x)
      as.ordered.owned <- function(x, ...) stop("must not dispatch")
      x <- structure(1:2, class="owned")
      c(identical(names(formals(base::as.factor)), "x"),
        identical(names(formals(base::as.ordered)), "x"),
        identical(class(as.factor(c("b", "a"))), "factor"),
        identical(class(as.ordered(c("b", "a"))), c("ordered", "factor")),
        identical(class(base::as.ordered(x)), c("ordered", "factor")),
        tryCatch({base::as.ordered(1:2, 3); FALSE}, error=function(e) TRUE))
    })`),
    ).toEqual(Array(6).fill(true));
  } finally {
    await r.dispose();
  }
});
