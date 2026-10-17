import { describe, expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independently authored cases observed with GNU R 4.6.1 as a black-box oracle.
// Precedence is documented in base::Syntax; no implementation source is used.
describe("operator deparsing", () => {
  it("uses R operator spacing in labels and ungrouped expressions", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`c(
        deparse(quote(1:4)), deparse(quote(a/b)), deparse(quote(a^b)),
        deparse(quote(a%%b)), deparse(quote(a%/%b)), deparse(quote(a %in% b)),
        deparse(quote(a + b * c)), deparse(quote(-x)), deparse(quote(!x)),
        deparse(quote(~x + y)), deparse(quote(x <- y <- 1)), deparse(quote(1 -> x))
      )`),
      ).resolves.toEqual([
        "1:4",
        "a/b",
        "a^b",
        "a%%b",
        "a%/%b",
        "a %in% b",
        "a + b * c",
        "-x",
        "!x",
        "~x + y",
        "x <- y <- 1",
        "x <- 1",
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it("reconstructs grouping required by precedence and associativity", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`c(
        deparse(quote((a + b) * c)), deparse(quote(a - (b - c))),
        deparse(quote(a + (b + c))), deparse(quote((a^b)^c)),
        deparse(quote(a^b^c)), deparse(quote((-a)^b)), deparse(quote(a^-b)),
        deparse(quote(!(a & b))), deparse(quote(!a == b)),
        deparse(quote((a < b) == c)), deparse(quote(a == (b < c))),
        deparse(quote((a + b)[1])), deparse(quote((function(x) x)(1)))
      )`),
      ).resolves.toEqual([
        "(a + b) * c",
        "a - (b - c)",
        "a + (b + c)",
        "(a^b)^c",
        "a^b^c",
        "(-a)^b",
        "a^-b",
        "!(a & b)",
        "!a == b",
        "(a < b) == c",
        "a == (b < c)",
        "(a + b)[1]",
        "(function(x) x)(1)",
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it("renders constructed operator calls and preserves their evaluation after parsing", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`
        a <- as.name("a"); b <- as.name("b"); c <- as.name("c")
        c(deparse(call("+", a, call("+", b, c))),
          deparse(call("^", call("^", a, b), c)),
          deparse(call("^", a, call("^", b, c))),
          deparse(call("-", call("-", a))),
          deparse(call("%combine%", a, b)), deparse(call("+", 1, 2, 3)),
          deparse(call("f", call("=", a, 1))), deparse(call("^", 2, -1)))
      `),
      ).resolves.toEqual([
        "a + (b + c)",
        "(a^b)^c",
        "a^b^c",
        "--a",
        "a %combine% b",
        "`+`(1, 2, 3)",
        "f((a = 1))",
        "2^-1",
      ]);
      await expect(
        runtime.eval(`
        inputs <- list(call("^", call("^", 2, 3), 2), call("^", 2, call("^", 3, 2)),
          call("-", 10, call("-", 5, 2)), call("/", 20, call("/", 10, 2)),
          call("*", call("+", 2, 3), 4), call("^", call("-", 2), 2))
        vapply(inputs, function(x) identical(eval(x), eval(parse(text = deparse(x)))), TRUE)
      `),
      ).resolves.toEqual([true, true, true, true, true, true]);
    } finally {
      await runtime.dispose();
    }
  });

  it("distinguishes scalar complex constants from unevaluated addition", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`c(deparse(1+2i), deparse(1-2i), deparse(2i),
        deparse(NA_complex_), deparse(complex(real=NaN, imaginary=2)),
        deparse(complex(real=Inf, imaginary=2)), deparse(complex(real=2, imaginary=Inf)),
        deparse(complex(real=1e-7, imaginary=2e-7)), deparse(quote(1+2i)))
      `),
      ).resolves.toEqual([
        "1+2i",
        "1-2i",
        "0+2i",
        "NA_complex_",
        "complex(real=NaN, imaginary=2)",
        "Inf+2i",
        "complex(real=2, imaginary=Inf)",
        "1e-07+2e-07i",
        "1 + (0+2i)",
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it("quotes nonsyntactic identifiers, argument tags, and function parameters", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`c(
        deparse(call("afill<-.default", as.name("*tmp*"), value = quote(-1:-6))),
        deparse(call("f", as.name("if"), as.name("TRUE"), as.name("NA_real_"))),
        deparse(call("f", as.name("a b"), as.name("_x"), as.name(".1"))),
        deparse(as.call(list(as.name("f"), "arg name" = as.name("*tmp*"))))
      )`),
      ).resolves.toEqual([
        "`afill<-.default`(`*tmp*`, value = -1:-6)",
        "f(`if`, `TRUE`, `NA_real_`)",
        "f(`a b`, `_x`, `.1`)",
        "f(`arg name` = `*tmp*`)",
      ]);
      await expect(runtime.eval("deparse(quote(function(`arg name`) `arg name`))")).resolves.toBe(
        "function(`arg name`) `arg name`",
      );
      await expect(
        runtime.eval('deparse(call("f", as.name("x`y"), as.name("x\\\\y"), as.name("a\\nb")))'),
      ).resolves.toBe("f(`x\\`y`, `x\\\\y`, `a\\nb`)");
      await expect(
        runtime.eval('c(as.vector(quote(1+2), "character"), sprintf("%s", list(quote(x+1))))'),
      ).resolves.toEqual(["+", "1", "2", "x + 1"]);
    } finally {
      await runtime.dispose();
    }
  });

  it("groups a trailing prefix expression before a following outer operator", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`
        a <- as.name("a"); b <- as.name("b"); c <- as.name("c")
        c(deparse(call("+", call("*", a, call("!", b)), c)),
          deparse(call("+", call("*", a, call("~", b)), c)),
          deparse(call("+", call("*", a, quote(if (TRUE) 1 else 2)), c)))
      `),
      ).resolves.toEqual(["a * (!b) + c", "a * (~b) + c", "a * (if (TRUE) 1 else 2) + c"]);
      await expect(
        runtime.eval(`
        x <- call("+", call("*", 2, call("!", 0)), 3)
        c(eval(x), eval(parse(text = deparse(x))))
      `),
      ).resolves.toEqual([5, 5]);
    } finally {
      await runtime.dispose();
    }
  });

  it("retains explicit grouping around expressions and assignment", async () => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      await expect(
        runtime.eval(`c(deparse(quote((a))), deparse(quote(a + (b * c))),
        deparse(quote(a^(b^c))), deparse(quote((x <- 1))))`),
      ).resolves.toEqual(["(a)", "a + (b * c)", "a^(b^c)", "(x <- 1)"]);
    } finally {
      await runtime.dispose();
    }
  });
});
