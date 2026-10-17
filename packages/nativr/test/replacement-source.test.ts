import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("retains replacement RHS syntax separately from evaluated call syntax", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
      count <- 0L
      bump <- function() { count <<- count + 1L; 3L }
      assign("probe<-", function(x, value) {
        list(source = substitute(value), call = sys.call(), matched = match.call(), value = value)
      })
      x <- 1
      probe(x) <- bump()
      c(identical(x$source, quote(bump())), identical(eval(x$call$value), 3L),
        identical(eval(x$matched$value), 3L), identical(x$value, 3L), identical(count, 1L))
    `),
    ).toEqual([true, true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("preserves replacement RHS reflection through S3 dispatch and subset receivers", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
      assign("probe<-", function(x, value) UseMethod("probe<-"))
      assign("probe<-.tag", function(x, value) {
        list(source = substitute(value), matchedValue = eval(match.call()$value), value = value)
      })
      container <- list(item = structure(1, class = "tag"))
      probe(container$item) <- 1 + 2
      c(identical(container$item$source, quote(1 + 2)),
        identical(container$item$matchedValue, 3), identical(container$item$value, 3))
    `),
    ).toEqual([true, true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("keeps RHS source in an escaping closure without evaluating it again", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
      count <- 0L
      bump <- function() { count <<- count + 1L; 3L }
      assign("probe<-", function(x, value) { e <- environment(); function() substitute(value, e) })
      x <- 1
      probe(x) <- bump()
      c(identical(x(), quote(bump())), identical(count, 1L))
    `),
    ).toEqual([true, true]);
  } finally {
    await runtime.dispose();
  }
});

it("distinguishes the original RHS from values rebuilt for outer replacements", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(
      await runtime.eval(`
      seen <- list()
      outer <- function(x) x
      assign("outer<-", function(x, value) { seen$outer <<- substitute(value); value })
      assign("inner<-", function(x, value) { seen$inner <<- substitute(value); value })
      x <- 1
      inner(outer(x)) <- 1 + 2
      first <- c(identical(seen$inner, quote(1 + 2)), identical(seen$outer, 3))
      outer(x)[1] <- 5 + 6
      c(first, identical(seen$outer, 11), identical(x, 11))
    `),
    ).toEqual([true, true, true, true]);
  } finally {
    await runtime.dispose();
  }
});
