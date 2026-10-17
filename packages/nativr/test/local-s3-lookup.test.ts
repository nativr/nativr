import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("looks for S3 methods in the generic caller's lexical chain", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        x <- structure(1L, class = "tag")
        gen <- local({
          gen.tag <- function(x) "definition"
          function(x) { gen.tag <- function(x) "generic-frame"; UseMethod("gen") }
        })
        gen.tag <- function(x) "global"
        caller <- local({ gen.tag <- function(x) "caller"; gen(x) })
        lexical <- local({
          gen.tag <- function(x) "lexical"
          invoke <- function() gen(x)
          invoke()
        })
        global <- gen(x)
        noncallable <- local({ gen.tag <- 42L; gen(x) })
        rm(gen.tag)
        definition_only <- tryCatch(gen(x), error = function(e) "missing")
        c(caller, lexical, global, noncallable, definition_only)
      `),
    ).toEqual(["caller", "lexical", "global", "global", "missing"]);
  } finally {
    await runtime.dispose();
  }
});

it("retains the original generic caller when NextMethod selects a local method", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        local({
          gen <- function(x) UseMethod("gen")
          gen.first <- function(x) {
            gen.second <- function(x) "method-frame"
            paste0("first/", NextMethod())
          }
          gen.second <- function(x) "second"
          gen.default <- function(x) "default"
          c(gen(structure(1L, class = c("first", "second"))), gen(1L))
        })
      `),
    ).toEqual(["first/second", "default"]);
  } finally {
    await runtime.dispose();
  }
});

it("lets caller methods override registered namespace methods and skips noncallable shadows", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        registerS3method("print", "tag", function(x, ...) "registered", envir = baseenv())
        x <- structure(1L, class = "tag")
        registered <- print(x)
        caller <- local({ print.tag <- function(x, ...) "caller"; print(x) })
        noncallable <- local({ print.tag <- FALSE; print(x) })
        print.tag <- function(x, ...) "visible"
        c(registered, caller, noncallable, print(x))
      `),
    ).toEqual(["registered", "caller", "registered", "visible"]);
  } finally {
    await runtime.dispose();
  }
});

it("passes the lexical caller to internal, operator, and member S3 dispatch", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        local({
          print.tag <- function(x, ...) "local-print"
          Ops.tag <- function(e1, e2) 99L
          assign("$.tag", function(x, name) paste0("local-", name))
          x <- structure(1L, class = "tag")
          c(print(x), x + 1L, x$field)
        })
      `),
    ).toEqual(["local-print", "99", "local-field"]);
  } finally {
    await runtime.dispose();
  }
});

it("consults the generic's top environment instead of private registration tables", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        gen <- eval(quote(function(x) UseMethod("gen")), globalenv())
        x <- structure(1L, class = "tag")
        left <- new.env()
        right <- new.env()
        left$gen <- eval(quote(function(x) UseMethod("gen")), left)
        right$gen <- eval(quote(function(x) UseMethod("gen")), right)
        registerS3method("gen", "tag", function(x) "private-left", envir = left)
        registerS3method("gen", "tag", function(x) "private-right", envir = right)
        before <- c(tryCatch(left$gen(x), error = function(e) "missing"),
          tryCatch(right$gen(x), error = function(e) "missing"))
        registerS3method("gen", "tag", function(x) "global")
        after <- c(left$gen(x), right$gen(x))
        left$gen.tag <- function(x) "caller"
        c(before, after, eval(quote(gen(x)), left), right$gen(x))
      `),
    ).toEqual(["missing", "missing", "global", "global", "caller", "global"]);
  } finally {
    await runtime.dispose();
  }
});

it("recognizes package environments by identity or package name and ignores the topenv option", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        gen <- eval(quote(function(x) UseMethod("gen")), globalenv())
        registerS3method("gen", "tag", function(x) "global")
        x <- structure(1L, class = "tag")
        e <- new.env()
        e$gen <- eval(quote(function(x) UseMethod("gen")), e)
        registerS3method("gen", "tag", function(x) "private", envir = e)
        ordinary <- e$gen(x)
        options(topLevelEnvironment = e)
        option <- e$gen(x)
        options(topLevelEnvironment = NULL)
        attr(e, "name") <- "package:example"
        package <- e$gen(x)
        attr(e, "name") <- "namespace:example"
        named <- e$gen(x)
        c(ordinary, option, package, named)
      `),
    ).toEqual(["global", "global", "private", "global"]);
  } finally {
    await runtime.dispose();
  }
});

it("uses the same top boundary for caller precedence and definition registration", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        registerS3method("print", "tag", function(x, ...) "registered", envir = baseenv())
        outer <- new.env()
        outer$print.tag <- function(x, ...) "outer"
        e <- new.env(parent = outer)
        e$x <- structure(1L, class = "tag")
        ordinary <- eval(quote(print(x)), e)
        attr(e, "name") <- "package:caller"
        package <- eval(quote(print(x)), e)
        e$print.tag <- function(x, ...) "caller"
        caller <- eval(quote(print(x)), e)
        c(ordinary, package, caller)
      `),
    ).toEqual(["outer", "registered", "caller"]);
  } finally {
    await runtime.dispose();
  }
});

it("retains definition top lookup across NextMethod and empty parent chains", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
        gen <- eval(quote(function(x) UseMethod("gen")), globalenv())
        registerS3method("gen", "first", function(x) paste0("first/", NextMethod()))
        registerS3method("gen", "second", function(x) "second")
        x <- structure(1L, class = c("first", "second"))
        e <- new.env(parent = emptyenv())
        e$UseMethod <- UseMethod
        f <- function(x) UseMethod("gen")
        environment(f) <- e
        e$gen <- f
        registerS3method("gen", "first", function(x) "private", envir = e)
        f(x)
      `),
    ).toBe("first/second");
  } finally {
    await runtime.dispose();
  }
});
