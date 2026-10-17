import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("selects named language-call elements through [, [[, and $", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- quote(f(a = 1, b = g(2), 3))
        c(
          typeof(x[2]), deparse(x[2]), typeof(x[[2]]), x[[2]],
          typeof(x[[3]]), deparse(x[[3]]), deparse(x["b"]),
          deparse(x[-1]), is.null(x[integer(0)]), x$a, deparse(x$b)
        )
      `),
    ).resolves.toEqual([
      "language",
      "1()",
      "double",
      "1",
      "language",
      "g(2)",
      "g(2)()",
      "1(b = g(2), 3)",
      "TRUE",
      "1",
      "g(2)",
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("edits a quoted subsetting call and evaluates its retained AST", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- matrix(1:6, nrow = 2)
        call <- quote(x[, drop = FALSE])
        call <- call[c(1, 2, 3, 3, 4)]
        call[[3]] <- 1:2
        call[[4]] <- 2:3
        result <- eval(call)
        c(dim(result), c(result), names(call))
      `),
    ).resolves.toEqual(["2", "2", "3", "4", "5", "6", "", "", "", "", "drop"]);
  } finally {
    await runtime.dispose();
  }
});

it("treats NULL subscripts as empty selections and no-op replacements", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- c(a = 1L, b = 2L)
        empty <- x[NULL]
        x[NULL] <- 7L
        args <- list(eps = 1e-4)
        args[names(list())] <- list()
        c(typeof(empty), length(empty), identical(x, c(a = 1L, b = 2L)),
          length(args), names(args), dim(matrix(1:6, 2, 3)[NULL, ]))
      `),
    ).resolves.toEqual(["integer", "0", "TRUE", "1", "eps", "0", "3"]);
  } finally {
    await runtime.dispose();
  }
});

it("extracts and replaces literal ... members in matched calls and lists", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        f <- function(...) {
          x <- match.call(expand.dots = FALSE)$...
          c(typeof(x), length(x), paste(names(as.list(x)), collapse = ","))
        }
        y <- list("..." = 3)
        before <- y$...
        y$... <- 4
        c(f(a = 1, b = 2), before, y$...)
      `),
    ).resolves.toEqual(["pairlist", "2", "a,b", "3", "4"]);
  } finally {
    await runtime.dispose();
  }
});

it("retains evaluated value and unevaluated dots in replacement-function match.call frames", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        assign("repl<-", function(x, value) {
          m <- match.call()
          c(identical(m[[1L]], as.name("repl<-")),
            identical(m$x, as.name("*tmp*")),
            identical(deparse(m$value), "7"), identical(eval(m$value), 7),
            identical(names(as.list(m)), c("", "x", "value")))
        })
        x <- 1
        repl(x) <- 3 + 4
        a <- x
        assign("more<-", function(x, ..., value) {
          m <- match.call(expand.dots = FALSE)
          c(identical(m[[1L]], as.name("more<-")),
            identical(m$x, as.name("*tmp*")),
            identical(deparse(m$value), "7"), identical(eval(m$value), 7),
            identical(typeof(m$...), "pairlist"), identical(length(m$...), 1L),
            identical(m$...$i, quote(1 + 2)))
        })
        y <- 1
        more(y, i = 1 + 2) <- 3 + 4
        c(a, y)
      `),
    ).resolves.toEqual(Array(12).fill(true));
  } finally {
    await runtime.dispose();
  }
});

it("retains the replacement call through S3 method dispatch", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        assign("repl2<-", function(x, value) UseMethod("repl2<-"))
        assign("repl2<-.foo", function(x, value) {
          m <- match.call()
          c(identical(m[[1L]], as.name("repl2<-.foo")),
            identical(m$x, as.name("*tmp*")),
            identical(deparse(m$value), "7"), identical(eval(m$value), 7),
            identical(names(as.list(m)), c("", "x", "value")))
        })
        z <- structure(1, class = "foo")
        repl2(z) <- 3 + 4
        z
      `),
    ).resolves.toEqual(Array(5).fill(true));
  } finally {
    await runtime.dispose();
  }
});

it("retains the original syntax through NextMethod", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        f <- function(x, ...) UseMethod("f")
        f.a <- function(x, ...) NextMethod()
        f.default <- function(x, ...) {
          m <- match.call()
          c(identical(m[[1L]], as.name("f.default")),
            identical(m$x, quote(structure(1, class = "a"))),
            identical(m$q, 2))
        }
        f(structure(1, class = "a"), q = 2)
      `),
    ).resolves.toEqual([true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("evaluates constructed subscript replacement calls through the subset path", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        x <- c(1L, 2L)
        eval(call("<-", call("[", as.name("x"), 2L), 9L))
        y <- list(a = 1L, b = 2L)
        eval(call("<-", call("[[", as.name("y"), 2L), 4L))
        z <- list(a = 1L)
        eval(call("<-", call("$", as.name("z"), as.name("a")), 5L))
        c(identical(x, c(1L, 9L)), identical(y, list(a = 1L, b = 4L)),
          identical(z, list(a = 5L)))
      `),
    ).resolves.toEqual([true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("matches calls against an explicit closure definition", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        f <- function(x, y, ...) {
          m <- match.call(definition = function(alpha, beta, ...) NULL, expand.dots = FALSE)
          c(identical(names(as.list(m)), c("", "alpha", "beta", "...")),
            identical(m$alpha, quote(1 + 2)), identical(m$beta, 3),
            identical(typeof(m$...), "pairlist"), identical(m$...$z, 4))
        }
        g <- function(alpha, beta = 2, ...) {
          m <- match.call(definition = g, expand.dots = FALSE)
          c(identical(names(as.list(m)), c("", "alpha", "...")),
            identical(m$alpha, quote(1 + 2)),
            identical(typeof(m$...), "pairlist"), identical(m$...$z, 4))
        }
        k <- function(x) identical(names(as.list(match.call(definition = NULL))), c("", "x"))
        c(f(1 + 2, 3, z = 4), g(al = 1 + 2, z = 4), k(1))
      `),
    ).resolves.toEqual(Array(10).fill(true));
  } finally {
    await runtime.dispose();
  }
});

it("matches an explicitly supplied language call without evaluating its arguments", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        f <- function(alpha, beta = 2, ...) NULL
        m <- match.call(definition = f,
          call = quote(f(al = 1 + 2, z = 4)), expand.dots = FALSE)
        g <- function(x, ...) {
          n <- match.call(call = quote(g(1 + 2, q = 4)), expand.dots = FALSE)
          c(identical(n[[1L]], as.name("g")),
            identical(names(as.list(n)), c("", "x", "...")),
            identical(n$x, quote(1 + 2)),
            identical(typeof(n$...), "pairlist"), identical(n$...$q, 4))
        }
        c(identical(m[[1L]], as.name("f")),
          identical(names(as.list(m)), c("", "alpha", "...")),
          identical(m$alpha, quote(1 + 2)),
          identical(typeof(m$...), "pairlist"), identical(m$...$z, 4), g(1))
      `),
    ).resolves.toEqual(Array(10).fill(true));
  } finally {
    await runtime.dispose();
  }
});

it("matches explicit calls against closure-shaped builtins and rejects primitives", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        expanded <- match.call(definition = file.exists,
          call = quote(file.exists(path = "x")))
        unexpanded <- match.call(definition = file.exists,
          call = quote(file.exists(path = "x")), expand.dots = FALSE)
        bad <- try(match.call(definition = sum, call = quote(sum(1L))), silent = TRUE)
        c(typeof(file.exists), names(formals(file.exists)),
          identical(names(as.list(expanded)), c("", "path")),
          identical(expanded$path, "x"),
          identical(names(as.list(unexpanded)), c("", "...")),
          identical(typeof(unexpanded$...), "pairlist"),
          identical(unexpanded$...$path, "x"),
          inherits(bad, "try-error"), conditionMessage(attr(bad, "condition")))
      `),
    ).resolves.toEqual([
      "closure",
      "...",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "invalid 'definition' argument",
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("quotes missing arguments in replacement S3 dots as empty symbols", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        assign("fill<-", function(x, ..., value) UseMethod("fill<-"))
        assign("fill<-.foo", function(x, ..., value) {
          dots <- match.call(expand.dots = FALSE)$...
          c(length(dots), paste(sapply(dots, typeof), collapse = ","),
            paste(sapply(dots, function(arg)
              is.symbol(arg) && as.character(arg) == ""), collapse = ","))
        })
        x <- structure(1, class = "foo")
        fill(x, 1, , ) <- 2
        c(x, typeof(quote(f(,))[[2L]]), as.character(quote(f(,))[[2L]]))
      `),
    ).resolves.toEqual(["3", "double,symbol,symbol", "FALSE,TRUE,TRUE", "symbol", ""]);
  } finally {
    await runtime.dispose();
  }
});
