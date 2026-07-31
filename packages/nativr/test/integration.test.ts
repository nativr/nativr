import { describe, expect, it } from "vitest";

import { createR, isComplex, isNA, isRaw, NA, RRuntimeDisposedError } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

async function session() {
  return createR({
    execution: "inline",
    assets,
  });
}

describe("complete inline source-to-result vertical slice", () => {
  it.each([
    ["1 + 1", 2],
    ["x <- c(1, 2, 3, 4, 5)\nmean(x)", 3],
    ["x <- c(1, NA, 3)\nmean(x, na.rm = TRUE)", 2],
    ["f <- function(x) x ^ 2\nf(4)", 16],
    ["c(1, 2, 3) + 10", [11, 12, 13]],
    ["c(1, 2, 3, 4) + c(10, 20)", [11, 22, 13, 24]],
  ])("evaluates %s", async (code, expected) => {
    const runtime = await session();
    await expect(runtime.eval(code)).resolves.toEqual(expected);
    await runtime.dispose();
  });

  it("captures GNU R-style print and cat output with invisible return values", async () => {
    const observed: { readonly stream: string; readonly text: string }[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onOutput: (event) => observed.push(event),
    });

    const printed = await runtime.evalDetailed("print(c(alpha = 1, beta = 2))");
    expect(printed.value).toEqual([1, 2]);
    expect(printed.visible).toBe(false);
    expect(printed.output).toEqual([{ stream: "stdout", text: "alpha beta\n    1    2\n" }]);
    expect(observed).toEqual(printed.output);

    const concatenated = await runtime.evalDetailed(
      'cat("a", 1, 2, sep = c("-", "|"))\ncat(NULL, 1)',
    );
    expect(concatenated.value).toBeNull();
    expect(concatenated.visible).toBe(false);
    expect(concatenated.output).toEqual([
      { stream: "stdout", text: "a-1|2" },
      { stream: "stdout", text: " 1" },
    ]);

    const matrix = await runtime.evalDetailed("print(matrix(1:6, nrow = 2))");
    expect(matrix.output[0]?.text).toBe(
      "     [,1] [,2] [,3]\n[1,]    1    3    5\n[2,]    2    4    6\n",
    );
    const closure = await runtime.evalDetailed("(function() return(print(1)))()");
    expect(closure.visible).toBe(false);
    expect(closure.output).toEqual([{ stream: "stdout", text: "[1] 1\n" }]);
    await runtime.dispose();
  });

  it("counts textual output against the evaluation output budget", async () => {
    const runtime = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 5 },
    });
    await expect(runtime.eval('cat("123456")')).rejects.toMatchObject({ code: "NRL4007" });
    await runtime.dispose();
  });

  it("implements frequency-prioritized head and structural inspection", async () => {
    const runtime = await session();
    await expect(
      runtime.eval('head(setNames(1:10, c("a", "b", "c", "d", "e", "f", "g", "h", "i", "j")))'),
    ).resolves.toEqual([1, 2, 3, 4, 5, 6]);
    await expect(runtime.eval("head(1:10, -3)")).resolves.toEqual([1, 2, 3, 4, 5, 6, 7]);
    await expect(runtime.eval("head(list(a = 1, b = 2, c = 3), 2)")).resolves.toEqual([1, 2]);
    const matrix = await runtime.evalDetailed("head(matrix(1:12, nrow = 4), 2)");
    expect(matrix.value).toEqual([1, 2, 5, 6, 9, 10]);
    expect(matrix.raw).toMatchObject({ type: "integer", dim: [2, 3] });
    await expect(runtime.eval('as.character(head(factor(c("a", "b", "a")), 2))')).resolves.toEqual([
      "a",
      "b",
    ]);

    const structure = await runtime.evalDetailed("str(c(1, NA, NaN))");
    expect(structure.value).toBeNull();
    expect(structure.visible).toBe(false);
    expect(structure.output).toEqual([{ stream: "stdout", text: " num [1:3] 1 NA NaN\n" }]);
    const named = await runtime.evalDetailed("str(c(alpha = 1, beta = 2))");
    expect(named.output[0]?.text).toBe(
      ' Named num [1:2] 1 2\n - attr(*, "names")= chr [1:2] "alpha" "beta"\n',
    );
    const list = await runtime.evalDetailed('str(list(alpha = 1, beta = "x"))');
    expect(list.output[0]?.text).toBe('List of 2\n $ alpha: num 1\n $ beta : chr "x"\n');
    const frame = await runtime.evalDetailed('str(data.frame(a = 1:2, b = c("x", "y")))');
    expect(frame.output[0]?.text).toContain("'data.frame':\t2 obs. of  2 variables:");
    expect(frame.output[0]?.text).toContain("$ a: int");
    await runtime.dispose();
  });

  it("implements strict recursive identity with documented comparison controls", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(identical(1L, 1), identical(0, -0), identical(0, -0, num.eq = FALSE), identical(NaN, NaN), identical(c(1, NA), c(1, NA)))",
      ),
    ).resolves.toEqual([false, true, false, true, true]);
    await expect(
      runtime.eval(
        "left <- structure(1, z = 2, a = 3)\nright <- structure(1, a = 3, z = 2)\nc(identical(left, right), identical(left, right, attrib.as.set = FALSE))",
      ),
    ).resolves.toEqual([true, false]);
    await expect(
      runtime.eval(
        'c(identical(list(a = 1, b = list("x")), list(a = 1, b = list("x"))), identical(pairlist(a = 1), pairlist(a = 1)), identical(quote(x + 1), quote(x + 1)), identical(expression(x + 1), expression(x + 1)))',
      ),
    ).resolves.toEqual([true, true, true, true]);
    await expect(
      runtime.eval(
        'c(identical(factor(c("a", "b")), factor(c("a", "b"))), identical(factor(c("a", "b")), factor(c("a", "b"), levels = c("b", "a"))))',
      ),
    ).resolves.toEqual([true, false]);
    await expect(
      runtime.eval(
        "e <- new.env()\nf1 <- eval(quote(function() 1), e)\nf2 <- eval(quote(function() 1), new.env())\nc(identical(e, e), identical(e, new.env()), identical(f1, f2), identical(f1, f2, ignore.environment = TRUE))",
      ),
    ).resolves.toEqual([true, false, false, true]);
    await runtime.dispose();
  });

  it("compares numeric, attributed, and recursive values with all.equal()", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(isTRUE(all.equal(1L, 1)), isTRUE(all.equal(c(1, 2), c(1, 2 + 1e-9))), is.character(all.equal(c(1, 2), c(1, 2 + 1e-6))))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval(
        "c(isTRUE(all.equal(1, 1.1, tolerance = 0.2)), is.character(all.equal(1, 1.1, tolerance = 0.01)))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(
      runtime.eval(
        "c(is.character(all.equal(c(a = 1, b = 2), c(a = 1, c = 2))), isTRUE(all.equal(c(a = 1, b = 2), c(a = 1, c = 2), check.attributes = FALSE)))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(
      runtime.eval(
        "c(isTRUE(all.equal(list(a = 1, b = list(2, 3)), list(a = 1, b = list(2, 3)))), is.character(all.equal(list(a = 1, b = list(2, 3)), list(a = 1, b = list(2, 4)))))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(
      runtime.eval(
        "c(isTRUE(all.equal(c(NA, NaN, Inf, -Inf), c(NaN, NA, Inf, -Inf))), isTRUE(TRUE), isFALSE(FALSE), isFALSE(NA))",
      ),
    ).resolves.toEqual([true, true, true, false]);
    await runtime.dispose();
  });

  it("selects lazy recycled branches with GNU R-compatible ifelse() shape and promotion", async () => {
    const runtime = await session();
    await expect(runtime.eval("ifelse(c(TRUE, FALSE, NA), 1L, 2L)")).resolves.toEqual([1, 2, NA]);
    await expect(runtime.eval('ifelse(c(TRUE, FALSE, NA), 1, "x")')).resolves.toEqual([
      "1",
      "x",
      NA,
    ]);
    await expect(runtime.eval("ifelse(c(TRUE, FALSE, TRUE), 1:2, 10:12)")).resolves.toEqual([
      1, 11, 1,
    ]);
    await expect(
      runtime.eval(
        "tracker <- 0\nvalue <- ifelse(c(FALSE, NA), { tracker <- 1; 1 }, 2)\nc(value, tracker)",
      ),
    ).resolves.toEqual([2, NA, 0]);
    await expect(
      runtime.eval(
        "value <- ifelse(matrix(c(TRUE, FALSE, NA, TRUE), 2), 1:4, 5:8)\nidentical(dim(value), c(2L, 2L))",
      ),
    ).resolves.toBe(true);
    await expect(runtime.eval("value")).resolves.toEqual([1, 6, NA, 4]);
    await expect(
      runtime.eval('ifelse(c(TRUE, FALSE, NA), list(1L, "yes"), list(FALSE, 4))'),
    ).resolves.toEqual([1, 4, NA]);
    await expect(runtime.eval("ifelse(TRUE, 1L)")).resolves.toBe(1);
    await runtime.dispose();
  });

  it("reduces logical values with GNU R-compatible any() and all() missingness", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(any(), all(), any(c(FALSE, NA), na.rm = TRUE), all(c(TRUE, NA), na.rm = TRUE))",
      ),
    ).resolves.toEqual([false, true, false, true]);
    await expect(
      runtime.eval("c(any(FALSE, NA), all(TRUE, NA), any(TRUE, NA), all(FALSE, NA))"),
    ).resolves.toEqual([NA, NA, true, false]);
    await expect(runtime.eval("c(any(list(TRUE, 0L, NA)), any(NA, na.r = TRUE))")).resolves.toEqual(
      [true, true],
    );

    const coerced = await runtime.evalDetailed("c(any(c(0, 1, NaN)), all(c(1+0i, 0+0i)))");
    expect(coerced.value).toEqual([true, false]);
    expect(coerced.warnings).toEqual([
      { code: "NRW1010", message: "coercing argument of type 'double' to logical" },
      { code: "NRW1010", message: "coercing argument of type 'complex' to logical" },
    ]);

    await expect(
      runtime.eval("tracker <- 0\nvalue <- any(TRUE, { tracker <- 1; FALSE })\nc(value, tracker)"),
    ).resolves.toEqual([1, 1]);
    await expect(runtime.eval('any(factor("no"))')).rejects.toThrow(/not meaningful/u);
    await runtime.dispose();
  });

  it("subsets vectors, matrices, and data frames through lazy data-mask expressions", async () => {
    const runtime = await session();
    await expect(runtime.eval("subset(1:5, c(TRUE, FALSE, TRUE))")).resolves.toEqual([1, 3, 4]);
    await expect(
      runtime.eval('subset(setNames(1:4, c("a", "b", "c", "d")), c(TRUE, NA, FALSE, TRUE))'),
    ).resolves.toEqual([1, 4]);
    await expect(
      runtime.eval(
        'd <- data.frame(a = 1:4, b = c("x", "y", "x", "y"), c = 5:8)\ns <- subset(d, a > 1, select = c(a, c))\nc(nrow(s), ncol(s), s$a, s$c)',
      ),
    ).resolves.toEqual([3, 2, 2, 3, 4, 6, 7, 8]);
    await expect(runtime.eval("names(s)")).resolves.toEqual(["a", "c"]);
    await expect(
      runtime.eval(
        "cutoff <- 2\nd <- data.frame(a = c(1, NA, 3), b = 4:6)\ns <- subset(d, a > cutoff)\nc(nrow(s), s$a, s$b)",
      ),
    ).resolves.toEqual([1, 3, 6]);
    await expect(
      runtime.eval("m <- matrix(1:6, 3)\ns <- subset(m, m[, 1] > 1, select = 2)\nc(dim(s), s)"),
    ).resolves.toEqual([2, 1, 5, 6]);
    await expect(runtime.eval("subset(1:3)")).rejects.toThrow(/subset.*missing/u);
    await runtime.dispose();
  });

  it("removes captured binding names from explicit and inherited environments", async () => {
    const runtime = await session();
    const removed = await runtime.evalDetailed("x <- 1\nrm(x)");
    expect(removed.value).toBeNull();
    expect(removed.visible).toBe(false);
    await expect(runtime.eval('exists("x")')).resolves.toBe(false);
    await expect(
      runtime.eval('x <- 1\ny <- 2\nrm(list = c("x", "y"))\nc(exists("x"), exists("y"))'),
    ).resolves.toEqual([false, false]);
    await expect(runtime.eval('x <- 1\nremove("x")\nexists("x")')).resolves.toBe(false);
    await expect(
      runtime.eval(
        'parent <- new.env()\nparent$x <- 1\nchild <- new.env(parent = parent)\nrm(x, envir = child, inherits = TRUE)\nexists("x", envir = parent, inherits = FALSE)',
      ),
    ).resolves.toBe(false);
    const missing = await runtime.evalDetailed("rm(absent_name)");
    expect(missing.warnings).toEqual([
      { code: "NRW1011", message: "object 'absent_name' not found" },
    ]);
    await runtime.dispose();
  });

  it("reverses core vector and list shapes with GNU R attribute behavior", async () => {
    const runtime = await session();
    await expect(runtime.eval("rev(1:5)")).resolves.toEqual([5, 4, 3, 2, 1]);
    await expect(
      runtime.eval('x <- setNames(c(TRUE, NA, FALSE), c("a", "b", "c"))\nnames(rev(x))'),
    ).resolves.toEqual(["c", "b", "a"]);
    await expect(runtime.eval('rev(list(a = 1, b = "x", c = TRUE))')).resolves.toEqual([
      true,
      "x",
      1,
    ]);
    await expect(
      runtime.eval(
        'x <- factor(c("a", "b", "a"))\ny <- rev(x)\nc(as.character(y), class(y), levels(y))',
      ),
    ).resolves.toEqual(["a", "b", "a", "factor", "a", "b"]);
    await expect(runtime.eval("is.null(dim(rev(matrix(1:6, 2))))")).resolves.toBe(true);
    await expect(
      runtime.eval("d <- data.frame(a = 1:2, b = 3:4)\ny <- rev(d)\nc(names(y), nrow(y))"),
    ).resolves.toEqual(["b", "a", "2"]);
    await expect(runtime.eval("rev(NULL)")).resolves.toBeNull();
    await runtime.dispose();
  });

  it("computes cumulative numeric summaries with type and missing propagation", async () => {
    const runtime = await session();
    await expect(runtime.eval("cumsum(1:5)")).resolves.toEqual([1, 3, 6, 10, 15]);
    await expect(runtime.eval("cumsum(c(TRUE, FALSE, TRUE))")).resolves.toEqual([1, 1, 2]);
    await expect(runtime.eval("cumsum(c(1L, NA, 3L))")).resolves.toEqual([1, NA, NA]);
    const nan = await runtime.eval("cumsum(c(1, NaN, 3))");
    expect(nan).toEqual([1, Number.NaN, Number.NaN]);
    await expect(runtime.eval("z <- cumprod(c(1+1i, 2-1i))\nc(Re(z), Im(z))")).resolves.toEqual([
      1, 3, 1, 1,
    ]);
    await expect(runtime.eval("cummax(c(1L, 3L, 2L, NA, 5L))")).resolves.toEqual([1, 3, 3, NA, NA]);
    await expect(runtime.eval("cummin(c(3, NaN, 2))")).resolves.toEqual([
      3,
      Number.NaN,
      Number.NaN,
    ]);
    await expect(
      runtime.eval('x <- setNames(1:3, c("a", "b", "c"))\nnames(cumsum(x))'),
    ).resolves.toEqual(["a", "b", "c"]);
    await expect(runtime.eval("is.null(dim(cumsum(matrix(1:4, 2))))")).resolves.toBe(true);
    const overflow = await runtime.evalDetailed("cumsum(c(2147483647L, 1L))");
    expect(overflow.value).toEqual([2_147_483_647, NA]);
    expect(overflow.warnings).toEqual([
      {
        code: "NRW1012",
        message: "integer overflow in 'cumsum'; use 'cumsum(as.numeric(.))'",
      },
    ]);
    await runtime.dispose();
  });

  it("runs function exit handlers and applies the AsIs class without forcing cleanup early", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        trace <- character()
        f <- function() {
          local_value <- 42
          on.exit(trace <<- c(trace, as.character(local_value)), add = TRUE)
          on.exit(trace <<- c(trace, "last"), add = TRUE)
          7
        }
        value <- f()
        c(value, trace)
      `),
    ).resolves.toEqual(["7", "42", "last"]);
    await expect(
      runtime.eval(`
        trace <- character()
        f <- function() {
          on.exit(trace <<- c(trace, "a"), add = TRUE, after = FALSE)
          on.exit(trace <<- c(trace, "b"), add = TRUE, after = FALSE)
          on.exit(trace <<- c(trace, "c"), add = TRUE, after = FALSE)
          return(12)
        }
        value <- f()
        c(value, trace)
      `),
    ).resolves.toEqual(["12", "c", "b", "a"]);
    await expect(
      runtime.eval(`
        trace <- character()
        f <- function() {
          on.exit(trace <<- c(trace, "discarded"))
          on.exit(trace <<- c(trace, "replacement"))
          stop("body failed")
        }
        message <- tryCatch(f(), error = function(e) conditionMessage(e))
        c(message, trace)
      `),
    ).resolves.toEqual(["body failed", "replacement"]);
    await runtime.eval(`
        trace <- character()
        f <- function() {
          on.exit(trace <<- c(trace, "cleared"))
          on.exit()
          invisible(3)
        }
        NULL
      `);
    const hidden = await runtime.evalDetailed("f()");
    expect(hidden.value).toBe(3);
    expect(hidden.visible).toBe(false);
    await expect(runtime.eval("length(trace)")).resolves.toBe(0);
    const topLevel = await runtime.evalDetailed("on.exit(1)");
    expect(topLevel.value).toBeNull();
    expect(topLevel.visible).toBe(false);

    await expect(runtime.eval("class(I(1:3))")).resolves.toBe("AsIs");
    await expect(runtime.eval('class(I(factor(c("a", "b"))))')).resolves.toEqual([
      "AsIs",
      "factor",
    ]);
    await expect(runtime.eval("dim(I(matrix(1:4, 2, 2)))")).resolves.toEqual([2, 2]);
    await expect(
      runtime.eval('class(I(structure(1:2, class = c("AsIs", "custom"))))'),
    ).resolves.toEqual(["AsIs", "custom"]);
    await expect(runtime.eval("I(NULL)")).rejects.toThrow(/attribute on NULL/u);
    await runtime.dispose();
  });

  it("inspects closure bodies and recursively flattens owned list shapes", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("f <- function(x) { y <- x + 1; y * 2 }\ndeparse1(body(f))"),
    ).resolves.toBe("{ (y <- (x + 1)); (y * 2) }");
    await expect(runtime.eval('deparse1(body("f"))')).resolves.toBe("{ (y <- (x + 1)); (y * 2) }");
    await expect(runtime.eval("body(sum)")).resolves.toBeNull();
    const nonFunction = await runtime.evalDetailed("body(NULL)");
    expect(nonFunction.value).toBeNull();
    expect(nonFunction.warnings).toEqual([
      { code: "NRW1013", message: "argument is not a function" },
    ]);

    await expect(runtime.eval("unlist(NULL)")).resolves.toBeNull();
    await expect(runtime.eval("unlist(list(TRUE, 2L, 3.5, 4 + 2i, 'x'))")).resolves.toEqual([
      "TRUE",
      "2",
      "3.5",
      "4+2i",
      "x",
    ]);
    await expect(
      runtime.eval("x <- unlist(list(a = 1:2, b = list(c = 3, 4)))\nc(x, names(x))"),
    ).resolves.toEqual(["1", "2", "3", "4", "a1", "a2", "b.c", "b"]);
    await expect(
      runtime.eval("is.null(names(unlist(list(a = 1:2, b = list(c = 3)), use.names = FALSE)))"),
    ).resolves.toBe(true);
    await expect(
      runtime.eval(
        "x <- unlist(list(a = 1:2, b = list(c = 3, d = 4:5)), recursive = FALSE)\nc(length(x), names(x), x[[4]])",
      ),
    ).resolves.toEqual(["4", "a1", "a2", "b.c", "b.d", "4", "5"]);
    await expect(
      runtime.eval(
        'x <- unlist(list(a = factor(c("x", "y")), b = factor("x")))\nc(as.character(x), class(x), levels(x), names(x))',
      ),
    ).resolves.toEqual(["x", "y", "x", "factor", "x", "y", "a1", "a2", "b"]);
    await expect(runtime.eval("unlist(pairlist(a = 1L, b = 2L))")).resolves.toEqual([1, 2]);
    await runtime.dispose();
  });

  it("transforms data masks and selects trailing vector or rectangular slices", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "d <- transform(data.frame(a = 1:3, b = 4:6), total = a + b, scaled = a * 10)\nc(names(d), d$a, d$b, d$total, d$scaled)",
      ),
    ).resolves.toEqual([
      "a",
      "b",
      "total",
      "scaled",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "5",
      "7",
      "9",
      "10",
      "20",
      "30",
    ]);
    await expect(
      runtime.eval(
        "d <- transform(data.frame(a = 1:3, b = 4:6), a = a * 2, b = NULL, z = 9)\nc(names(d), d$a, d$z, nrow(d))",
      ),
    ).resolves.toEqual(["a", "z", "2", "4", "6", "9", "9", "9", "3"]);
    await expect(
      runtime.eval(
        "offset <- 5\nd <- transform(list(a = 1:3), b = a + offset)\nc(class(d), d$a, d$b)",
      ),
    ).resolves.toEqual(["data.frame", "1", "2", "3", "6", "7", "8"]);
    await expect(
      runtime.eval("transform(data.frame(x = 1:2), y = x + 1, z = y + 1)"),
    ).rejects.toMatchObject({ code: "NRE2001" });

    await expect(
      runtime.eval(
        'x <- tail(setNames(1:10, c("a", "b", "c", "d", "e", "f", "g", "h", "i", "j")), 3)\nc(x, names(x))',
      ),
    ).resolves.toEqual(["8", "9", "10", "h", "i", "j"]);
    await expect(runtime.eval("tail(1:10, -3)")).resolves.toEqual([4, 5, 6, 7, 8, 9, 10]);
    await expect(runtime.eval("tail(1:3, Inf)")).resolves.toEqual([1, 2, 3]);
    await expect(
      runtime.eval("m <- tail(matrix(1:12, nrow = 4), 2)\nc(dim(m), m)\n"),
    ).resolves.toEqual([2, 3, 3, 4, 7, 8, 11, 12]);
    await expect(
      runtime.eval(
        'd <- data.frame(a = 1:4, b = 5:8)\nattr(d, "row.names") <- c("a", "b", "c", "d")\nd <- tail(d, 2)\nc(d$a, d$b, rownames(d))',
      ),
    ).resolves.toEqual(["3", "4", "7", "8", "c", "d"]);
    await expect(
      runtime.eval(
        "x <- tail(expression(a + b, c * d, e), 2)\nc(length(x), identical(x, expression(c * d, e)))",
      ),
    ).resolves.toEqual([2, 1]);
    await runtime.dispose();
  });

  it("resolves dynamic parent frames and transposes owned matrix shapes", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'f <- function() parent.frame()\ng <- function() { marker <- 9; get("marker", envir = f(), inherits = FALSE) }\nc(g(), identical((function() parent.frame())(), globalenv()))',
      ),
    ).resolves.toEqual([9, 1]);
    await expect(
      runtime.eval(
        "f <- function() parent.frame(2)\ng <- function() f()\nidentical(g(), globalenv())",
      ),
    ).resolves.toBe(true);
    await expect(runtime.eval("parent.frame(0)")).rejects.toThrow(/positive integer/u);

    await expect(
      runtime.eval('x <- t(setNames(1:3, c("a", "b", "c")))\nc(dim(x), x, dimnames(x)[[2]])'),
    ).resolves.toEqual(["1", "3", "1", "2", "3", "a", "b", "c"]);
    await expect(
      runtime.eval(
        'x <- matrix(1:6, nrow = 2, dimnames = list(c("r1", "r2"), c("c1", "c2", "c3")))\ny <- t(x)\nc(dim(y), y, unlist(dimnames(y)))',
      ),
    ).resolves.toEqual(["3", "2", "1", "3", "5", "2", "4", "6", "c1", "c2", "c3", "r1", "r2"]);
    await expect(
      runtime.eval("x <- t(factor(c('a', 'b')))\nc(dim(x), as.character(x), class(x), levels(x))"),
    ).resolves.toEqual(["1", "2", "a", "b", "factor", "a", "b"]);
    await expect(
      runtime.eval("x <- t(data.frame(a = 1:2, b = 3:4))\nc(dim(x), x, unlist(dimnames(x)))"),
    ).resolves.toEqual(["2", "2", "1", "3", "2", "4", "a", "b"]);
    await runtime.dispose();
  });

  it("inspects closure formals and repeatedly evaluates lazy expressions", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'f <- function(x, y = 2L, z = x + y, ..., flag = TRUE) NULL\np <- formals(f)\nc(typeof(p), names(p), typeof(p$x), identical(p$y, 2L), identical(p$z, quote(x + y)), typeof(p[["..."]]))',
      ),
    ).resolves.toEqual([
      "pairlist",
      "x",
      "y",
      "z",
      "...",
      "flag",
      "symbol",
      "TRUE",
      "TRUE",
      "symbol",
    ]);
    await expect(
      runtime.eval("c(is.null(formals(sum)), is.null(formals('sum')))"),
    ).resolves.toEqual([true, true]);
    const nonFunction = await runtime.evalDetailed("formals(1)");
    expect(nonFunction.value).toBeNull();
    expect(nonFunction.warnings).toEqual([
      { code: "NRW1013", message: "argument is not a function" },
    ]);

    await expect(runtime.eval("replicate(4, 2 + 3)")).resolves.toEqual([5, 5, 5, 5]);
    await expect(runtime.eval("x <- replicate(3, 1:2)\nc(dim(x), x)")).resolves.toEqual([
      2, 3, 1, 2, 1, 2, 1, 2,
    ]);
    await expect(
      runtime.eval("x <- replicate(3, matrix(1:4, 2), simplify = 'array')\nc(dim(x), x)"),
    ).resolves.toEqual([2, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
    await expect(
      runtime.eval("i <- 0\nx <- replicate(4, { i <<- i + 1; i })\nc(x, i)"),
    ).resolves.toEqual([1, 2, 3, 4, 4]);
    await expect(
      runtime.eval("x <- replicate(2, list(a = 1), simplify = FALSE)\nc(length(x), x[[1]]$a)"),
    ).resolves.toEqual([2, 1]);
    await expect(runtime.eval("length(replicate(0, stop('not evaluated')))")).resolves.toBe(0);
    await expect(runtime.eval("replicate(2.9, 1)")).resolves.toEqual([1, 1]);
    await runtime.dispose();
  });

  it("splits core data shapes by measured grouping semantics and floors real vectors", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'x <- floor(matrix(c(1.9, -1.1, 2.2, 3.8), 2, dimnames = list(c("r1", "r2"), c("c1", "c2"))))\nc(typeof(x), dim(x), x, unlist(dimnames(x)))',
      ),
    ).resolves.toEqual(["double", "2", "2", "1", "-2", "2", "3", "r1", "r2", "c1", "c2"]);
    await expect(runtime.eval("floor(c(a = 1.9, b = NA, c = NaN, d = Inf))")).resolves.toEqual([
      1,
      { __nativr__: "NA" },
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]);
    await expect(runtime.eval("floor(1 + 2i)")).rejects.toMatchObject({ code: "NRT3233" });
    await expect(runtime.eval("floor(factor(c('a', 'b')))")).rejects.toMatchObject({
      code: "NRT3233",
    });

    await expect(
      runtime.eval(
        'x <- split(setNames(1:6, c("a", "b", "c", "d", "e", "f")), c("b", "a", "b"))\nc(names(x), x$a, names(x$a), x$b, names(x$b))',
      ),
    ).resolves.toEqual(["a", "b", "2", "5", "b", "e", "1", "3", "4", "6", "a", "c", "d", "f"]);
    await expect(
      runtime.eval(
        'f <- factor(c("b", "a", "b", NA), levels = c("b", "unused", "a"))\nx <- split(1:4, f)\ny <- split(1:4, f, drop = TRUE)\nc(names(x), lengths(x), names(y), lengths(y))',
      ),
    ).resolves.toEqual(["b", "unused", "a", "2", "0", "1", "b", "a", "2", "1"]);

    const recycled = await runtime.evalDetailed('x <- split(1:5, c("a", "b"))\nc(x$a, x$b)');
    expect(recycled.value).toEqual([1, 3, 5, 2, 4]);
    expect(recycled.warnings).toEqual([
      { code: "NRW1014", message: "data length is not a multiple of split variable" },
    ]);
    await expect(
      runtime.eval(
        'd <- data.frame(a = 1:4, b = c("a", "b", "c", "d"))\nattr(d, "row.names") <- c("r1", "r2", "r3", "r4")\nx <- split(d, c("g", "h", "g", "h"))\nc(names(x), x$g$a, x$g$b, rownames(x$g), x$h$a, x$h$b, rownames(x$h))',
      ),
    ).resolves.toEqual(["g", "h", "1", "3", "a", "c", "r1", "r3", "2", "4", "b", "d", "r2", "r4"]);
    await expect(
      runtime.eval(
        'x <- split(1:4, list(c("a", "b", "a", "b"), c("x", "x", "y", "y")), sep = ":", lex.order = TRUE)\nc(names(x), unlist(x))',
      ),
    ).resolves.toEqual(["a:x", "a:y", "b:x", "b:y", "1", "3", "2", "4"]);
    await expect(runtime.eval("split(1:3, character())")).rejects.toMatchObject({
      code: "NRE2142",
    });
    await runtime.dispose();
  });

  it("rounds usage-ranked values upward with Math dispatch and attributes", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- ceiling(c(-Inf, -2.7, -0.1, 0, 0.1, 2.7, Inf, NaN, NA))\nc(x[1:7], is.nan(x[8]), is.na(x[9]), typeof(x))",
      ),
    ).resolves.toEqual(["-Inf", "-2", "0", "0", "1", "3", "Inf", "TRUE", "TRUE", "double"]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 1.2, b = NA), class = 'custom', marker = 'kept')\ny <- ceiling(x)\nc(y[1], is.na(y[2]), names(y), class(y), attr(y, 'marker'))",
      ),
    ).resolves.toEqual(["2", "TRUE", "a", "b", "custom", "kept"]);
    await expect(
      runtime.eval(
        "x <- ceiling(matrix(c(1.2, -1.2, NA, NaN), 2, dimnames = list(c('r1', 'r2'), c('a', 'b'))))\nc(dim(x), x[1:2], is.na(x[3]), is.nan(x[4]), unlist(dimnames(x)))",
      ),
    ).resolves.toEqual(["2", "2", "2", "-1", "TRUE", "TRUE", "r1", "r2", "a", "b"]);
    await expect(
      runtime.eval(
        "roundup <- function(x, n) ceiling(ceiling(x) / n) * n\nc(roundup(c(0, 1.1, 4, 4.1, -1.1), 4), typeof(ceiling(c(TRUE, 2L))))",
      ),
    ).resolves.toEqual(["0", "4", "4", "8", "0", "double"]);
    await expect(
      runtime.eval(
        "set.seed(123)\nx <- ceiling(rexp(20))\nc(typeof(x), length(x), all(x >= 1), identical(x, floor(x)))",
      ),
    ).resolves.toEqual(["double", "20", "TRUE", "TRUE"]);
    await runtime.eval(
      "ceiling.direct <- function(x) 42\nMath.grouped <- function(x, ...) 99\nNULL",
    );
    await expect(
      runtime.eval(
        "c(ceiling(structure(1, class = 'direct')), ceiling(structure(1, class = 'grouped')))",
      ),
    ).resolves.toEqual([42, 99]);
    await expect(runtime.eval("ceiling(1 + 2i)")).rejects.toMatchObject({ code: "NRT3286" });
    await expect(runtime.eval("ceiling(factor(c('a', 'b')))")).rejects.toMatchObject({
      code: "NRT3286",
    });
    await expect(runtime.eval("ceiling(as.Date('2020-01-01'))")).rejects.toMatchObject({
      code: "NRT3286",
    });
    await runtime.dispose();
  });

  it("truncates usage-ranked values toward zero with package method dispatch", async () => {
    const runtime = await session();
    await runtime.eval(
      "trunc.ITime <- function(x, units = c('hours', 'minutes'), ...) {\n  units <- match.arg(units)\n  step <- if (units == 'hours') 3600L else 60L\n  structure(unclass(x) - unclass(x) %% step, class = class(x))\n}\nNULL",
    );
    await expect(
      runtime.eval(
        "seqtimes <- structure(c(25200L, 25220L, 28799L, 28800L), class = 'ITime')\nx <- trunc(seqtimes, 'hours')\nc(x, class(x))",
      ),
    ).resolves.toEqual(["25200", "25200", "25200", "28800", "ITime"]);
    await expect(
      runtime.eval(
        "x <- trunc(c(-Inf, -2.7, -0.1, -0, 0, 0.1, 2.7, Inf, NaN, NA))\nc(x[1:8], is.nan(x[9]), is.na(x[10]), typeof(x), 1 / x[3])",
      ),
    ).resolves.toEqual([
      "-Inf",
      "-2",
      "0",
      "0",
      "0",
      "0",
      "2",
      "Inf",
      "TRUE",
      "TRUE",
      "double",
      "-Inf",
    ]);
    await expect(
      runtime.eval(
        "x <- trunc(structure(c(a = 1.9, b = -1.9), dim = c(2L, 1L), marker = 'kept'))\nc(x, dim(x), names(x), attr(x, 'marker'), typeof(trunc(c(TRUE, 2L))))",
      ),
    ).resolves.toEqual(["1", "-1", "2", "1", "a", "b", "kept", "double"]);
    await runtime.eval(
      "trunc.direct <- function(x, ..., marker = 'default') c(42, list(...)[[1]], marker)\nMath.grouped <- function(x, ..., marker = 'default') c(99, list(...)[[1]], marker)\nNULL",
    );
    await expect(
      runtime.eval(
        "c(trunc(structure(1, class = 'direct'), 'dot', marker = 'direct'), trunc(structure(1, class = 'grouped'), 'dot', marker = 'group'))",
      ),
    ).resolves.toEqual(["42", "dot", "direct", "99", "dot", "group"]);
    await expect(runtime.eval("trunc(1.9, marker = stop('forced'))")).rejects.toMatchObject({
      code: "NRE2300",
    });
    await expect(runtime.eval("trunc(1 + 2i)")).rejects.toMatchObject({ code: "NRT3328" });
    await expect(runtime.eval("trunc(factor(c('a', 'b')))")).rejects.toMatchObject({
      code: "NRT3328",
    });
    await expect(runtime.eval("trunc('1.2')")).rejects.toMatchObject({ code: "NRT3102" });
    await runtime.dispose();
  });

  it("converts usage-ranked split fields through the utils type ladder", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "parts <- list(c('Yes', 'No'), c('10', '20'), c('30.5', '10.2'), c('2000-03-01', '2000-04-01'))\nx <- lapply(parts, function(x) utils::type.convert(x, as.is = TRUE))\nc(typeof(x[[1]]), x[[1]], typeof(x[[2]]), x[[2]], typeof(x[[3]]), x[[3]], typeof(x[[4]]), x[[4]])",
      ),
    ).resolves.toEqual([
      "character",
      "Yes",
      "No",
      "integer",
      "10",
      "20",
      "double",
      "30.5",
      "10.2",
      "character",
      "2000-03-01",
      "2000-04-01",
    ]);
    await expect(
      runtime.eval(
        "a <- type.convert(c('T', 'FALSE', 'NA', ''), as.is = TRUE)\nb <- type.convert(c(' 1', '+2', '-3', 'NA', ''), as.is = TRUE)\nc0 <- type.convert(c('1e2', '.5', '0x10', 'Inf', '-infinity', 'NaN', 'NA'), as.is = TRUE)\nz <- type.convert(c('1+2i', '-3i', '4', 'NA'), as.is = TRUE)\nc(typeof(a), a, typeof(b), b, typeof(c0), c0[1:5], is.nan(c0[6]), is.na(c0[7]), typeof(z), Re(z), Im(z), is.na(z[4]))",
      ),
    ).resolves.toEqual([
      "logical",
      "TRUE",
      "FALSE",
      { __nativr__: "NA" },
      { __nativr__: "NA" },
      "integer",
      "1",
      "2",
      "-3",
      { __nativr__: "NA" },
      { __nativr__: "NA" },
      "double",
      "100",
      "0.5",
      "16",
      "Inf",
      "-Inf",
      "TRUE",
      "TRUE",
      "complex",
      "1",
      "0",
      "4",
      { __nativr__: "NA" },
      "2",
      "-3",
      "0",
      { __nativr__: "NA" },
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "a <- type.convert(c(B = 'B', A = 'A', missing = NA), as.is = FALSE)\nb <- type.convert(c('B', 'A', NA), as.is = TRUE)\nm <- type.convert(matrix(c('1', '2', '3', '4'), 2, dimnames = list(c('r1', 'r2'), c('a', 'b'))), as.is = TRUE)\nd <- type.convert(data.frame(x = c('1', '2'), y = c('T', 'F')), as.is = TRUE)\nc(as.character(a), levels(a), is.null(names(a)), b, is.null(names(b)), m, dim(m), unlist(dimnames(m)), typeof(d$x), d$x, typeof(d$y), d$y, class(d))",
      ),
    ).resolves.toEqual([
      "B",
      "A",
      { __nativr__: "NA" },
      "A",
      "B",
      "TRUE",
      "B",
      "A",
      { __nativr__: "NA" },
      "TRUE",
      "1",
      "2",
      "3",
      "4",
      "2",
      "2",
      "r1",
      "r2",
      "a",
      "b",
      "integer",
      "1",
      "2",
      "logical",
      "TRUE",
      "FALSE",
      "data.frame",
    ]);
    await runtime.eval(
      "type.convert.foo <- function(x, ..., marker = 'default') c('method', unclass(x), marker, list(...)[['dot']])\nNULL",
    );
    await expect(
      runtime.eval("type.convert(structure('x', class = 'foo'), marker = 'ok', dot = 'yes')"),
    ).resolves.toEqual(["method", "x", "ok", "yes"]);
    const warned = await runtime.evalDetailed("type.convert(c('1', '2'))");
    expect(warned.value).toEqual([1, 2]);
    expect(warned.warnings).toEqual([
      { code: "NRW1022", message: "'as.is' should be specified by the caller; using TRUE" },
    ]);
    await expect(runtime.eval("type.convert(new.env(), as.is = TRUE)")).rejects.toMatchObject({
      code: "NRT3329",
    });
    await runtime.dispose();
  });

  it("interpolates usage-ranked numeric and date coordinates through stats", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "fit <- stats::approx(c(2000, 2010), c(281.4, 308.7), 2000:2010)\nc(fit$x, round(fit$y, 2))",
      ),
    ).resolves.toEqual([
      2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 281.4, 284.13, 286.86,
      289.59, 292.32, 295.05, 297.78, 300.51, 303.24, 305.97, 308.7,
    ]);
    await expect(
      runtime.eval(
        "d <- as.Date(c('2020-01-01', '2020-01-11'))\nout <- approx(d, c(2000, 2010), xout = as.Date('2020-01-06'))\nc(out$y, class(out$x), as.character(out$x))",
      ),
    ).resolves.toEqual(["2005", "Date", "18267"]);
    await expect(
      runtime.eval(
        "a <- approx(c(1, 3), c(10, 30), xout = c(0, 2, 4), rule = 2)\nb <- approx(c(1, 3), c(10, 30), xout = 2, method = 'constant', f = .25)\nc(a$y, b$y)",
      ),
    ).resolves.toEqual([10, 20, 30, 15]);
    await expect(
      runtime.eval(
        "a <- approx(c(1, 1, 2), c(10, 20, 30), xout = c(1, 1.5), ties = min)\nb <- approx(c(10, 20, 40), n = 3)\nc(a$y, b$x, b$y)",
      ),
    ).resolves.toEqual([10, 20, 1, 2, 3, 10, 20, 40]);
    await expect(
      runtime.eval(
        "a <- approx(c(1, 2, 3), c(10, NA, 30), xout = c(1, 2, 3))\nb <- approx(c(1, 3), c(10, 30), xout = c(NA, NaN, 2))\nc(a$y, is.na(b$y[1]), is.nan(b$y[2]), b$y[3])",
      ),
    ).resolves.toEqual([10, 20, 30, 1, 1, 20]);
    const duplicate = await runtime.evalDetailed("approx(c(1, 1, 2), c(10, 20, 30), xout = 1)$y");
    expect(duplicate.value).toBe(15);
    expect(duplicate.warnings).toEqual([
      { code: "NRW1104", message: "collapsing to unique 'x' values" },
    ]);
    await expect(
      runtime.eval("approx(c(1, NA, 3), c(10, 20, 30), xout = 2, na.rm = FALSE)"),
    ).rejects.toMatchObject({ code: "NRT3290" });
    await runtime.dispose();
  });

  it("minimizes frequency-ranked nonlinear objectives through stats::nlm", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "f <- function(x) sum((x - 1:length(x)) ^ 2)\nout <- stats::nlm(f, c(10, 10))\nc(abs(out$estimate - c(1, 2)) < 1e-5, out$minimum < 1e-10, length(out$gradient), out$code %in% 1:3, out$iterations > 0, names(out))",
      ),
    ).resolves.toEqual([
      "TRUE",
      "TRUE",
      "TRUE",
      "2",
      "TRUE",
      "TRUE",
      "minimum",
      "estimate",
      "gradient",
      "code",
      "iterations",
    ]);
    await expect(
      runtime.eval(
        "f <- function(x, target) sum((x - target) ^ 2)\nout <- nlm(f, c(10, 10), target = c(3, 5), hessian = TRUE)\nc(abs(out$estimate - c(3, 5)) < 1e-5, round(out$hessian, 3), dim(out$hessian), out$code %in% 1:4)",
      ),
    ).resolves.toEqual([1, 1, 2, 0, 0, 2, 2, 2, 1]);
    await expect(
      runtime.eval(
        "tfun2 <- function(y) { lp <- log((y - 5) ^ 2 + 1); attr(lp, 'gradient') <- 2 * (y - 5) / ((y - 5) ^ 2 + 1); lp }\nout <- nlm(tfun2, 10)\nc(abs(out$estimate - 5) < 1e-5, out$minimum < 1e-10, abs(out$gradient) < 1e-5, out$code %in% 1:3)",
      ),
    ).resolves.toEqual([true, true, true, true]);
    await expect(runtime.eval("nlm(function(x) sum(x ^ 2), 1, hess = TRUE)")).rejects.toMatchObject(
      { code: "NRE2005" },
    );
    await expect(runtime.eval("nlm(function(x) x, c(1, 2))")).rejects.toMatchObject({
      code: "NRT3291",
    });
    await expect(runtime.eval("nlm(function(x) sum(x ^ 2), NULL)")).rejects.toMatchObject({
      code: "NRT3291",
    });
    await runtime.dispose();
  });

  it("runs the frequency-ranked stats::optim BFGS callback path", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "tfun <- function(y) log((y - 5) ^ 2 + 1)\ntgrfun <- function(y) 2 * (y - 5) / ((y - 5) ^ 2 + 1)\nout <- stats::optim(1, tfun, tgrfun, method = 'BFGS')\nc(abs(out$par - 5) < 1e-5, out$value < 1e-10, out$convergence == 0, identical(names(out), c('par', 'value', 'counts', 'convergence', 'message')), identical(names(out$counts), c('function', 'gradient')), all(out$counts > 0))",
      ),
    ).resolves.toEqual([true, true, true, true, true, true]);
    await expect(
      runtime.eval(
        "out <- optim(c(a = 8, b = 9), function(x, target) sum((x - target) ^ 2), target = c(1, 2), method = 'BFGS', hessian = TRUE)\nc(all(abs(out$par - c(1, 2)) < 1e-5), out$value < 1e-10, out$convergence == 0, identical(names(out$par), c('a', 'b')), identical(dim(out$hessian), c(2L, 2L)), identical(dimnames(out$hessian), list(c('a', 'b'), c('a', 'b'))), max(abs(out$hessian - diag(2, 2))) < 1e-3)",
      ),
    ).resolves.toEqual([true, true, true, true, true, true, true]);
    await expect(
      runtime.eval(
        "out <- optim(0, function(x) -(x - 3) ^ 2, method = 'BFGS', control = list(fnscale = -1, maxit = 50, reltol = 1e-10))\nc(abs(out$par - 3) < 1e-5, abs(out$value) < 1e-10, out$convergence == 0)",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval("optim(1, function(x) x ^ 2, method = 'BFGS', meth = 'BFGS')"),
    ).rejects.toMatchObject({
      code: "NRE2005",
    });
    await expect(runtime.eval("optim(1, function(x) x ^ 2)")).rejects.toMatchObject({
      code: "NRU6145",
    });
    await expect(
      runtime.eval("optim(c(1, 2), function(x) sum(x ^ 2), function(x) 1, method = 'BFGS')"),
    ).rejects.toMatchObject({ code: "NRT3292" });
    await runtime.dispose();
  });

  it("dispatches the frequency-ranked graphics::pairs package extension point", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "pairs.stanfit <- function(x, labels = NULL, panel = NULL, ..., pars = NULL, include = TRUE, condition = 'accept_stat__') c(class(x), pars, include, condition, list(...)$log, list(...)$las)\nfit <- structure(1:3, class = 'stanfit')\ngraphics::pairs(fit, pars = c('mu', 'sigma'), log = TRUE, las = 1)",
      ),
    ).resolves.toEqual(["stanfit", "mu", "sigma", "TRUE", "accept_stat__", "TRUE", "1"]);
    await expect(
      runtime.eval(
        "pairs.lazy <- function(x, ..., marker = 'ok') marker\npairs(structure(1, class = 'lazy'), stop('unused dot remains lazy'))",
      ),
    ).resolves.toBe("ok");
    await expect(runtime.eval("pairs(matrix(1:4, 2))")).rejects.toMatchObject({
      code: "NRU6146",
    });
    await runtime.dispose();
  });

  it("dispatches zoo's frequency-ranked stats::update package extension point", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        update.trellis <- function(object, ..., redraw = TRUE) {
          c(class(object), list(...)$type, redraw)
        }
        plot <- structure(list(), class = "trellis")
        result <- withVisible(stats::update(plot, type = c("l", "g")))
        c(result$value, result$visible)
      `),
    ).resolves.toEqual(["trellis", "l", "g", "TRUE", "TRUE"]);
    await expect(
      runtime.eval(`
        update.lazy <- function(object, ..., marker = "ok") marker
        update(structure(1, class = "lazy"), stop("unused dot remains lazy"))
      `),
    ).resolves.toBe("ok");
    await expect(
      runtime.eval(`
        update.child <- function(object, ...) c("child", NextMethod())
        update.parent <- function(object, ...) "parent"
        update(structure(1, class = c("child", "parent")), stop("still lazy"))
      `),
    ).resolves.toEqual(["child", "parent"]);
    await expect(runtime.eval("update(list())")).rejects.toMatchObject({ code: "NRU6166" });
    await expect(
      runtime.eval(`
        update.default <- function(object, ..., evaluate = TRUE) {
          c(object, evaluate, list(...)$gain)
        }
        stats::update(3, gain = 2, evaluate = FALSE)
      `),
    ).resolves.toEqual([3, 0, 2]);
    await expect(runtime.eval("update()")).rejects.toMatchObject({ code: "NRE2147" });
    await runtime.dispose();
  });

  it("draws bit64's frequency-ranked graphics::matplot matrix series", async () => {
    const runtime = await session();
    const observed: unknown[] = [];
    const listening = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const plotted = await listening.evalDetailed(`
      values <- matrix(c(0, 1, 2, 10, NA, 30), 3, 2)
      graphics::matplot(
        values,
        type = "b",
        pch = c("d", "i"),
        col = c("red", "blue"),
        lty = 1:2,
        lwd = c(1, 2),
        xlab = "tasks",
        ylab = "relative speed",
        axes = FALSE
      )
    `);
    expect(plotted.value).toBeNull();
    expect(plotted.visible).toBe(false);
    expect(plotted.graphics).toHaveLength(4);
    expect(plotted.graphics[0]).toEqual({ kind: "new-page" });
    expect(plotted.graphics[1]).toEqual({
      kind: "window",
      xlim: [0.92, 3.08],
      ylim: [-1.2, 31.2],
    });
    expect(plotted.graphics[2]).toEqual({
      kind: "segments",
      segments: [
        {
          x0: 1,
          y0: 0,
          x1: 2,
          y1: 1,
          color: "#FF0000FF",
          lineType: "solid",
          lineWidth: 1,
        },
        {
          x0: 2,
          y0: 1,
          x1: 3,
          y1: 2,
          color: "#FF0000FF",
          lineType: "solid",
          lineWidth: 1,
        },
      ],
    });
    expect(plotted.graphics[3]).toMatchObject({
      kind: "points",
      points: [
        { x: 1, y: 0, symbol: "d", color: "#FF0000FF", lineWidth: 1 },
        { x: 2, y: 1, symbol: "d", color: "#FF0000FF", lineWidth: 1 },
        { x: 3, y: 2, symbol: "d", color: "#FF0000FF", lineWidth: 1 },
        { x: 1, y: 10, symbol: "i", color: "#0000FFFF", lineWidth: 2 },
        { x: 3, y: 30, symbol: "i", color: "#0000FFFF", lineWidth: 2 },
      ],
    });
    expect(observed).toEqual(plotted.graphics);

    const logged = await listening.evalDetailed(`
      matplot(
        1:3,
        cbind(c(1, 10, 100), c(2, 20, 200)),
        type = "b",
        pch = c("d", "i"),
        log = "y",
        axes = FALSE
      )
    `);
    expect(logged.graphics).toHaveLength(4);
    expect(logged.graphics[1]).toMatchObject({
      kind: "window",
      xlim: [0.92, 3.08],
    });
    const logMaximum = Math.log10(200);
    const logPadding = logMaximum * 0.04;
    const window = logged.graphics[1];
    expect(window?.kind).toBe("window");
    if (window?.kind === "window") {
      expect(window.ylim[0]).toBeCloseTo(-logPadding, 14);
      expect(window.ylim[1]).toBeCloseTo(logMaximum + logPadding, 14);
    }
    const loggedSegments = logged.graphics[2];
    expect(loggedSegments?.kind).toBe("segments");
    if (loggedSegments?.kind === "segments") {
      expect(loggedSegments.segments).toHaveLength(4);
      expect(loggedSegments.segments[0]).toMatchObject({ x0: 1, y0: 0, x1: 2, y1: 1 });
      expect(loggedSegments.segments[2]?.x0).toBe(1);
      expect(loggedSegments.segments[2]?.y0).toBeCloseTo(Math.log10(2), 14);
      expect(loggedSegments.segments[2]?.x1).toBe(2);
      expect(loggedSegments.segments[2]?.y1).toBeCloseTo(Math.log10(20), 14);
    }
    const loggedPoints = logged.graphics[3];
    expect(loggedPoints?.kind).toBe("points");
    if (loggedPoints?.kind === "points") {
      expect(loggedPoints.points).toHaveLength(6);
      expect(loggedPoints.points[2]).toMatchObject({ x: 3, y: 2, symbol: "d" });
      expect(loggedPoints.points[5]?.x).toBe(3);
      expect(loggedPoints.points[5]?.y).toBeCloseTo(Math.log10(200), 14);
      expect(loggedPoints.points[5]?.symbol).toBe("i");
    }

    const framed = await listening.evalDetailed(
      "matplot(matrix(1:6, 3, 2), type = 'n', col = 'green')",
    );
    expect(framed.graphics).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0.92, 3.08], ylim: [0.8, 6.2] },
      {
        kind: "box",
        edges: ["top", "right", "bottom", "left"],
        color: "#00FF00FF",
        lineType: "solid",
        lineWidth: 1,
      },
    ]);
    await listening.eval("saved <- recordPlot()");
    const replayed = await listening.evalDetailed("replayPlot(saved)");
    expect(replayed.graphics).toEqual(framed.graphics);
    await listening.dispose();

    await expect(runtime.eval("matplot()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("matplot(1:3, 1:2)")).rejects.toMatchObject({ code: "NRT3350" });
    await expect(runtime.eval("matplot(c(-1, 0), log = 'y')")).rejects.toMatchObject({
      code: "NRT3350",
    });
    await expect(runtime.eval("matplot(1:3, type = 'h')")).rejects.toMatchObject({
      code: "NRU6167",
    });
    await expect(runtime.eval("matplot(1:3, add = TRUE)")).rejects.toMatchObject({
      code: "NRU6167",
    });
    await expect(runtime.eval("matplot(1:3, main = 'unsupported')")).rejects.toMatchObject({
      code: "NRU6167",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 10 },
    });
    await expect(limited.eval("matplot(matrix(1:12, 4, 3))")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("generates the frequency-ranked grDevices heat palette", async () => {
    const runtime = await session();
    await expect(runtime.eval("grDevices::heat.colors(5)")).resolves.toEqual([
      "#FF0000",
      "#FF5500",
      "#FFAA00",
      "#FFFF00",
      "#FFFF80",
    ]);
    await expect(runtime.eval("heat.colors(5, alpha = 0.5, rev = TRUE)")).resolves.toEqual([
      "#FFFF8080",
      "#FFFF0080",
      "#FFAA0080",
      "#FF550080",
      "#FF000080",
    ]);
    await expect(
      runtime.eval(
        "c(heat.colors(3.9), length(heat.colors(0)), length(heat.colors(-1)), is.null(names(heat.colors(setNames(3, 'n')))))",
      ),
    ).resolves.toEqual(["#FF0000", "#FF8000", "#FFFF00", "0", "0", "TRUE"]);
    await expect(runtime.eval("heat.colors(3, alpha = 2)")).rejects.toMatchObject({
      code: "NRT3293",
    });
    await runtime.dispose();
  });

  it("generates zoo's frequency-ranked gamma-corrected gray palettes and levels", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("c(grDevices::gray.colors(2, start = 0.7), grey(7:1 / 8))"),
    ).resolves.toEqual([
      "#B3B3B3",
      "#E6E6E6",
      "#DFDFDF",
      "#BFBFBF",
      "#9F9F9F",
      "#808080",
      "#606060",
      "#404040",
      "#202020",
    ]);
    await expect(
      runtime.eval(`
        c(
          gray.colors(5),
          grey.colors(5, start = 0, end = 1, gamma = 1),
          gray.colors(3, alpha = c(0, 0.5, 1), rev = TRUE)
        )
      `),
    ).resolves.toEqual([
      "#4D4D4D",
      "#888888",
      "#AEAEAE",
      "#CCCCCC",
      "#E6E6E6",
      "#000000",
      "#404040",
      "#808080",
      "#BFBFBF",
      "#FFFFFF",
      "#E6E6E6FF",
      "#AEAEAE80",
      "#4D4D4D00",
    ]);
    await expect(
      runtime.eval(`
        c(
          gray(0:8 / 8),
          grey(c(0.1, 0.5, 0.9), c(0.5, 1)),
          identical(gray(c(0.2, 0.8)), grey(c(0.2, 0.8))),
          is.null(attributes(gray(structure(c(0.2, 0.8), names = c("a", "b"), tag = "drop"))))
        )
      `),
    ).resolves.toEqual([
      "#000000",
      "#202020",
      "#404040",
      "#606060",
      "#808080",
      "#9F9F9F",
      "#BFBFBF",
      "#DFDFDF",
      "#FFFFFF",
      "#1A1A1A80",
      "#808080FF",
      "#E6E6E680",
      "TRUE",
      "TRUE",
    ]);
    await expect(
      runtime.eval(`
        c(
          gray.colors(3.9),
          length(gray.colors(0)),
          gray.colors(3, gamma = 0),
          gray.colors(3, gamma = -1),
          gray.colors(2, start = 0.9, end = 0.1),
          gray(c("0", "0.5", "1")),
          gray(c(FALSE, TRUE), alpha = TRUE)
        )
      `),
    ).resolves.toEqual([
      "#4D4D4D",
      "#969696",
      "#C3C3C3",
      "#E6E6E6",
      "0",
      "#FFFFFF",
      "#FFFFFF",
      "#FFFFFF",
      "#4D4D4D",
      "#737373",
      "#E5E5E5",
      "#E6E6E6",
      "#191919",
      "#000000",
      "#808080",
      "#FFFFFF",
      "#000000FF",
      "#FFFFFFFF",
    ]);

    for (const source of [
      "gray()",
      "gray(c(0, NA_real_))",
      "gray(c(-0.1, 1.1))",
      "gray(0.5, numeric())",
      "gray(0.5, 2)",
      "gray.colors()",
      "gray.colors(-1)",
      "gray.colors(3, start = -0.1)",
      "gray.colors(3, gamma = NA_real_)",
      "gray.colors(3, alpha = 2)",
      "gray.colors(3, rev = NA)",
      "gray.colors(3, start = c(0.2, 0.8))",
    ]) {
      await expect(runtime.eval(source), source).rejects.toMatchObject({
        code: source === "gray()" || source === "gray.colors()" ? "NRE2103" : "NRT3348",
      });
    }
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 12 },
    });
    await expect(limited.eval("gray.colors(13)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("computes the frequency-ranked factorial surface", async () => {
    const runtime = await session();
    await expect(runtime.eval("factorial(10)")).resolves.toBe(3_628_800);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 0L, b = 5L, c = 10L), tag = 'kept')\ny <- factorial(x)\nc(y, names(y), attr(y, 'tag'), typeof(y))",
      ),
    ).resolves.toEqual(["1", "120", "3628800", "a", "b", "c", "kept", "double"]);
    await expect(
      runtime.eval(
        "c(abs(factorial(0.5) - sqrt(pi) / 2) < 1e-12, abs(factorial(-0.5) - sqrt(pi)) < 1e-12, factorial(171) == Inf, length(factorial(numeric())) == 0)",
      ),
    ).resolves.toEqual([true, true, true, true]);
    const poles = await runtime.evalDetailed("factorial(c(-2, NA, NaN, -Inf))");
    expect(poles.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced" }]);
    await expect(runtime.eval("factorial(1 + 2i)")).rejects.toMatchObject({ code: "NRT3294" });
    await runtime.dispose();
  });

  it("fits the frequency-ranked bounded stats::lsfit surface", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "fit <- stats::lsfit(1:9, 1:9)\nc(abs(fit$coefficients['Intercept']) < 1e-12, abs(fit$coefficients['X'] - 1) < 1e-12, max(abs(fit$residuals)) < 1e-12, fit$intercept, identical(names(fit), c('coefficients', 'residuals', 'intercept', 'qr')), identical(names(fit$qr), c('qt', 'qr', 'qraux', 'rank', 'pivot', 'tol')), inherits(fit$qr, 'qr'))",
      ),
    ).resolves.toEqual([true, true, true, true, true, true, true]);
    await expect(
      runtime.eval(
        "fit <- lsfit(cbind(a = 1:4, b = c(0, 1, 0, 1)), c(2, 5, 4, 7), intercept = TRUE)\nc(abs(fit$coefficients - c(1, 1, 2)) < 1e-12, fit$qr$rank == 3)",
      ),
    ).resolves.toEqual([true, true, true, true]);
    const missing = await runtime.evalDetailed(
      "fit <- lsfit(c(1, 2, NA, 4), c(2, NA, 6, 8))\nc(abs(fit$coefficients - c(0, 2)) < 1e-12, is.na(fit$residuals), fit$qr$rank == 2)",
    );
    expect(missing.warnings).toEqual([{ code: "NRW1112", message: "2 missing values deleted" }]);
    expect(missing.value).toEqual([true, true, false, true, true, false, true]);
    await expect(runtime.eval("lsfit(1:4, cbind(1:4, 2:5))")).rejects.toMatchObject({
      code: "NRU6147",
    });
    await runtime.dispose();
  });

  it("wraps the frequency-ranked character paragraphs", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("strwrap(rep('alpha beta gamma delta epsilon zeta eta theta', 2), width = 15)"),
    ).resolves.toEqual([
      "alpha beta",
      "gamma delta",
      "epsilon zeta",
      "eta theta",
      "alpha beta",
      "gamma delta",
      "epsilon zeta",
      "eta theta",
    ]);
    await expect(
      runtime.eval(
        "strwrap(c('alpha beta gamma delta epsilon zeta eta theta', 'one two three'), width = 12, simplify = FALSE)",
      ),
    ).resolves.toEqual([
      ["alpha beta", "gamma delta", "epsilon", "zeta eta", "theta"],
      ["one two", "three"],
    ]);
    await expect(
      runtime.eval(
        "c(strwrap('alpha beta gamma delta epsilon zeta eta theta', width = 18, indent = 2, exdent = 4, prefix = '> ', initial = '* '), strwrap('one two\\nthree four\\n\\nfive six', width = 9), strwrap(c('', '   ', NA, 1), width = 10))",
      ),
    ).resolves.toEqual([
      "*   alpha beta",
      ">     gamma delta",
      ">     epsilon",
      ">     zeta eta",
      ">     theta",
      "one two",
      "three",
      "four",
      "",
      "five six",
      "",
      "",
      "NA",
      "1",
    ]);
    await expect(runtime.eval("strwrap('one', width = 5, indent = -1)")).rejects.toMatchObject({
      code: "NRT3296",
    });
    await runtime.dispose();
  });

  it("converts the usage-ranked stringr color path in both directions", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "col2hex <- function(col) {\n  rgb <- col2rgb(col)\n  rgb(rgb['red', ], rgb['green', ], rgb['blue', ], maxColorValue = 255)\n}\ncol2hex(c('red', 'blue', 'green'))",
      ),
    ).resolves.toEqual(["#FF0000", "#0000FF", "#00FF00"]);
    await expect(
      runtime.eval(
        "m <- grDevices::col2rgb(c(blu = 'royalblue', reddish = 'tomato'))\nc(m, dim(m), rownames(m), colnames(m), typeof(m))",
      ),
    ).resolves.toEqual([
      "65",
      "105",
      "225",
      "255",
      "99",
      "71",
      "3",
      "2",
      "red",
      "green",
      "blue",
      "blu",
      "reddish",
      "integer",
    ]);
    await expect(
      runtime.eval(
        "c(col2rgb(c(long = '#559955', short = '#595', rgba = '#1234', rgba8 = '#10203040'), alpha = TRUE), col2rgb(c(1L, 8L, 9L)), col2rgb(c('yellowgreen', NA), alpha = TRUE))",
      ),
    ).resolves.toEqual([
      85, 153, 85, 255, 85, 153, 85, 255, 17, 34, 51, 68, 16, 32, 48, 64, 0, 0, 0, 158, 158, 158, 0,
      0, 0, 154, 205, 50, 255, 255, 255, 255, 0,
    ]);
    await expect(runtime.eval("col2rgb('not-a-colour')")).rejects.toMatchObject({
      code: "NRT3297",
    });
    await expect(runtime.eval("rgb(NA, 0, 0)")).rejects.toMatchObject({ code: "NRT3298" });
    await runtime.dispose();
  });

  it("simplifies the usage-ranked stringi list shapes into arrays", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- simplify2array(list(c('a', 'b'), c('c', 'd'), c('e', 'f')))\nb <- simplify2array(list('a', c('b', 'c')))\nc(a, dim(a), is.list(b), length(b), b[[1]], b[[2]])",
      ),
    ).resolves.toEqual(["a", "b", "c", "d", "e", "f", "2", "3", "TRUE", "2", "a", "b", "c"]);
    await expect(
      runtime.eval(
        "x <- simplify2array(list(one = c(a = 1L, b = 2L), two = c(c = 3L, d = 4L)))\nc(x, dim(x), rownames(x), colnames(x), typeof(x))",
      ),
    ).resolves.toEqual(["1", "2", "3", "4", "2", "2", "a", "b", "one", "two", "integer"]);
    await expect(
      runtime.eval(
        "x <- list(first = matrix(1:4, 2, dimnames = list(c('r1', 'r2'), c('c1', 'c2'))), second = matrix(5:8, 2, dimnames = list(c('r1', 'r2'), c('c1', 'c2'))))\na <- simplify2array(x)\nb <- simplify2array(x, higher = FALSE)\nc(a, dim(a), dimnames(a)[[1]], dimnames(a)[[2]], dimnames(a)[[3]], dim(b), colnames(b))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "2",
      "2",
      "2",
      "r1",
      "r2",
      "c1",
      "c2",
      "first",
      "second",
      "4",
      "2",
      "first",
      "second",
    ]);
    await expect(
      runtime.eval(
        "a <- simplify2array(list(one = 1L, two = 2, three = TRUE))\nb <- simplify2array(list(one = 1L, two = 2L), except = NULL)\nc(a, names(a), typeof(a), b, dim(b), colnames(b))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "1",
      "one",
      "two",
      "three",
      "double",
      "1",
      "2",
      "1",
      "2",
      "one",
      "two",
    ]);
    await expect(
      runtime.eval("simplify2array(list(1:2, 3:4), higher = c(FALSE, TRUE))"),
    ).rejects.toMatchObject({ code: "NRT3299" });
    await runtime.dispose();
  });

  it("generates factors and joins data frames by frequency-ranked key semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'x <- gl(3, 2, length = 10, labels = c("low", "mid", "high"), ordered = TRUE)\nc(as.integer(x), as.character(x), levels(x), class(x))',
      ),
    ).resolves.toEqual([
      "1",
      "1",
      "2",
      "2",
      "3",
      "3",
      "1",
      "1",
      "2",
      "2",
      "low",
      "low",
      "mid",
      "mid",
      "high",
      "high",
      "low",
      "low",
      "mid",
      "mid",
      "low",
      "mid",
      "high",
      "ordered",
      "factor",
    ]);
    await expect(
      runtime.eval("c(as.integer(gl(2.9, 1.9, length = 5.9)), levels(gl(0, 1)))"),
    ).resolves.toEqual(["1", "2", "1", "2", "1"]);
    await expect(runtime.eval("levels(gl(3, 1, labels = c('a', 'b')))")).resolves.toEqual([
      "a",
      "b",
    ]);

    const frames =
      'x <- data.frame(id = c(2L, 1L, 1L, NA), left = c("x2", "x1a", "x1b", "xna"))\ny <- data.frame(id = c(1L, 3L, 1L, NA), right = c(10L, 30L, 11L, 99L))';
    await expect(
      runtime.eval(
        `${frames}\nm <- merge(x, y)\nc(names(m), nrow(m), m$id[1:4], m$left[1:4], m$right[1:4], is.na(m$id[5]), m$left[5], m$right[5])`,
      ),
    ).resolves.toEqual([
      "id",
      "left",
      "right",
      "5",
      "1",
      "1",
      "1",
      "1",
      "x1a",
      "x1a",
      "x1b",
      "x1b",
      "10",
      "11",
      "10",
      "11",
      "TRUE",
      "xna",
      "99",
    ]);
    await expect(
      runtime.eval(
        `${frames}\nm <- merge(x, y, all = TRUE)\nc(nrow(m), m$id[1:6], is.na(m$id[7]), m$left[1:5], is.na(m$left[6]), m$left[7], m$right[1:4], is.na(m$right[5]), m$right[6:7])`,
      ),
    ).resolves.toEqual([
      "7",
      "1",
      "1",
      "1",
      "1",
      "2",
      "3",
      "TRUE",
      "x1a",
      "x1a",
      "x1b",
      "x1b",
      "x2",
      "TRUE",
      "xna",
      "10",
      "11",
      "10",
      "11",
      "TRUE",
      "30",
      "99",
    ]);
    await expect(
      runtime.eval(
        'x <- data.frame(k1 = c("b", "a", "a"), k2 = c(1L, 2L, 1L), value = 1:3)\ny <- data.frame(other = c("a", "a", "c"), k2 = c(1L, 2L, 1L), value = 4:6)\nm <- merge(x, y, by.x = c("k1", "k2"), by.y = c("other", "k2"))\nc(names(m), m$k1, m$k2, m$value.x, m$value.y)',
      ),
    ).resolves.toEqual(["k1", "k2", "value.x", "value.y", "a", "a", "1", "2", "3", "2", "4", "5"]);
    await expect(
      runtime.eval(
        'm <- merge(data.frame(a = 1:2), data.frame(b = c("x", "y")), by = character())\nc(names(m), m$a, m$b)',
      ),
    ).resolves.toEqual(["a", "b", "1", "2", "1", "2", "x", "x", "y", "y"]);
    await expect(
      runtime.eval('merge(data.frame(a = 1), data.frame(a = 1), by = "missing")'),
    ).rejects.toMatchObject({ code: "NRT3234" });
    await runtime.dispose();
  });

  it("mutates data masks and computes vectorized real and complex sine", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "d <- within(data.frame(a = 1:3, b = 4:6), { total <- a + b; b <- NULL; a <- a * 2 })\nc(names(d), d$a, d$total, rownames(d))",
      ),
    ).resolves.toEqual(["a", "total", "2", "4", "6", "5", "7", "9", "1", "2", "3"]);
    await expect(
      runtime.eval(
        "x <- within(list(a = 1:3, b = 4:6), { total <- a + b; b <- NULL; scalar <- 9 })\nc(names(x), x$a, is.null(x$b), x$scalar, x$total)",
      ),
    ).resolves.toEqual(["a", "b", "scalar", "total", "1", "2", "3", "TRUE", "9", "5", "7", "9"]);
    await expect(runtime.eval("names(within(list(a = 1), { b <- 2; c <- 3 }))")).resolves.toEqual([
      "a",
      "c",
      "b",
    ]);
    await expect(
      runtime.eval("offset <- 10\nd <- within(data.frame(a = 1:2), b <- a + offset)\nc(d$a, d$b)"),
    ).resolves.toEqual([1, 2, 11, 12]);
    await expect(runtime.eval("within(data.frame(a = 1:3), b <- 1:2)")).rejects.toMatchObject({
      code: "NRE2116",
    });
    await expect(runtime.eval("within(1:3, x <- 2)")).rejects.toMatchObject({
      code: "NRT3236",
    });

    await expect(runtime.eval("sin(c(TRUE, FALSE, 0L, 1L))")).resolves.toEqual([
      Math.sin(1),
      0,
      0,
      Math.sin(1),
    ]);
    await expect(
      runtime.eval(
        'x <- structure(matrix(c(0, 1.5707963267948966, NA, NaN), 2), label = "kept")\ny <- sin(x)\nc(typeof(y), dim(y), y[1:2], is.na(y[3]), is.nan(y[4]), attr(y, "label"))',
      ),
    ).resolves.toEqual(["double", "2", "2", "0", "1", "TRUE", "TRUE", "kept"]);
    await expect(
      runtime.eval(
        "z <- sin(c(1 + 2i, NA_complex_, NaN + 1i))\nc(Re(z[1]), Im(z[1]), is.na(z[2]), is.nan(Re(z[3])), is.nan(Im(z[3])))",
      ),
    ).resolves.toEqual([3.165778513216168, 1.9596010414216063, 1, 1, 1]);
    const infinite = await runtime.evalDetailed("sin(c(Inf, -Inf))");
    expect(infinite.value).toEqual([Number.NaN, Number.NaN]);
    expect(infinite.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await expect(runtime.eval("sin(factor('a'))")).rejects.toMatchObject({ code: "NRT3237" });
    await expect(runtime.eval("sin(as.raw(1))")).rejects.toMatchObject({ code: "NRT3102" });
    await runtime.dispose();
  });

  it("coerces vectors and package objects through frequency-ranked as.array dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- as.array(setNames(1:3, c('a', 'b', 'c')))\ny <- structure(4:6, tag = 'kept')\ny <- as.array.default(y, stop('dots stay lazy'))\nc(dim(x), class(x), dimnames(x)[[1]], is.null(names(x)), dim(y), attr(y, 'tag'))",
      ),
    ).resolves.toEqual(["3", "array", "a", "b", "c", "FALSE", "3", "kept"]);
    await expect(
      runtime.eval(
        "m <- matrix(1:4, 2, dimnames = list(c('r1', 'r2'), c('c1', 'c2')))\nf <- as.array(factor(setNames(c('b', 'a'), c('one', 'two'))))\np <- as.array(pairlist(a = 1, b = 2))\nc(identical(as.array(m), m), dim(f), levels(f), class(f), dimnames(f)[[1]], is.null(names(f)), dim(p), names(p), dimnames(p)[[1]], class(p))",
      ),
    ).resolves.toEqual([
      "TRUE",
      "2",
      "a",
      "b",
      "factor",
      "one",
      "two",
      "FALSE",
      "2",
      "a",
      "b",
      "a",
      "b",
      "array",
    ]);
    await runtime.eval(
      "as.array.stanfit <- function(x, ..., pars = c('a', 'b', 'c')) array(as.vector(x), c(1, 2, 3), list('iteration', c('chain1', 'chain2'), pars))\nNULL",
    );
    await expect(
      runtime.eval(
        "fit <- structure(1:6, class = 'stanfit')\na <- as.array(fit, pars = c('alpha', 'beta', 'gamma'))\nc(dim(a), unlist(dimnames(a)))",
      ),
    ).resolves.toEqual(["1", "2", "3", "iteration", "chain1", "chain2", "alpha", "beta", "gamma"]);
    await expect(runtime.eval("as.array(NULL)")).rejects.toMatchObject({ code: "NRT3287" });
    await expect(runtime.eval("as.array(data.frame(x = 1:2))")).rejects.toMatchObject({
      code: "NRT3287",
    });
    await expect(runtime.eval("as.array(expression(x))")).rejects.toMatchObject({
      code: "NRT3287",
    });
    await runtime.dispose();
  });

  it("coerces factors and applies grouped ave transformations", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'x <- as.factor(setNames(c(10, 2, 10, NA), c("a", "b", "c", "d")))\nc(as.integer(x), as.character(x), levels(x), names(x), class(x))',
      ),
    ).resolves.toEqual([
      "2",
      "1",
      "2",
      NA,
      "10",
      "2",
      "10",
      NA,
      "2",
      "10",
      "a",
      "b",
      "c",
      "d",
      "factor",
    ]);
    await expect(
      runtime.eval(
        'x <- ordered(c("b", "a"))\ny <- as.factor(x)\nc(identical(x, y), class(y), levels(y), as.integer(y))',
      ),
    ).resolves.toEqual(["TRUE", "ordered", "factor", "a", "b", "2", "1"]);
    await expect(
      runtime.eval(
        "x <- as.ordered(letters[1:5])\nc(as.integer(x), as.character(x), levels(x), class(x))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "a",
      "b",
      "c",
      "d",
      "e",
      "a",
      "b",
      "c",
      "d",
      "e",
      "ordered",
      "factor",
    ]);
    await expect(
      runtime.eval(
        "x <- factor(setNames(c('b', 'a', NA), c('one', 'two', 'three')), levels = c('b', 'a', 'unused'))\ny <- as.ordered(x)\nc(as.integer(y), levels(y), class(y), names(y), identical(as.ordered(y), y))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      NA,
      "b",
      "a",
      "ordered",
      "factor",
      "one",
      "two",
      "three",
      "TRUE",
    ]);
    await runtime.eval(
      "as.ordered.custom <- function(x, ..., marker = 'default') c(marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval("as.ordered(structure(1:2, class = 'custom'), marker = 'ok', extra = 'dot')"),
    ).resolves.toEqual(["ok", "dot"]);
    await expect(runtime.eval("as.ordered(list(1))")).rejects.toMatchObject({ code: "NRT3132" });
    await expect(
      runtime.eval(
        "x <- as.factor(matrix(c(2, 1), 1))\nc(as.integer(x), levels(x), is.null(dim(x)))",
      ),
    ).resolves.toEqual(["2", "1", "1", "2", "TRUE"]);

    await expect(
      runtime.eval('ave(setNames(1:5, c("a", "b", "c", "d", "e")), c("a", "a", "b", "b", "b"))'),
    ).resolves.toEqual([1.5, 1.5, 4, 4, 4]);
    await expect(
      runtime.eval('ave(1:6, c("a", "a", "b", "b", "b", "a"), FUN = sum)'),
    ).resolves.toEqual([9, 9, 12, 12, 12, 9]);
    await expect(
      runtime.eval('ave(1:6, c("a", "a", "b", "b", "b", "a"), FUN = rev)'),
    ).resolves.toEqual([6, 2, 5, 4, 3, 1]);
    await expect(
      runtime.eval('ave(1:6, c("a", "a", "a", "b", "b", "b"), c(1, 2, 1, 1, 2, 1), FUN = mean)'),
    ).resolves.toEqual([2, 2, 2, 5, 5, 5]);
    await expect(runtime.eval('ave(1:5, c("a", NA, "a", NA, "b"), FUN = "sum")')).resolves.toEqual([
      4, 2, 4, 4, 5,
    ]);
    await expect(runtime.eval("ave(1:4)")).resolves.toEqual([2.5, 2.5, 2.5, 2.5]);
    await expect(
      runtime.eval(
        'x <- factor(c("a", "b", "a"))\ny <- ave(x, c(1, 1, 2), FUN = function(v) v[1])\nc(as.character(y), class(y), levels(y))',
      ),
    ).resolves.toEqual(["a", "a", "a", "factor", "a", "b"]);
    await expect(runtime.eval('ave(1:5, c("a", "b"), FUN = sum)')).rejects.toMatchObject({
      code: "NRT3238",
    });
    await runtime.dispose();
  });

  it("constructs UTC dates and Cartesian data-frame grids by measured priority", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'x <- ISOdate(c(1970, 2000), 1, c(1, 2))\nc(typeof(x), class(x), attr(x, "tzone"), x)',
      ),
    ).resolves.toEqual(["double", "POSIXct", "POSIXt", "GMT", "43200", "946814400"]);
    await expect(
      runtime.eval(
        'x <- ISOdate(1970:1972, c(1, 2), 1, hour = 0, tz = "UTC")\nc(attr(x, "tzone"), x)',
      ),
    ).resolves.toEqual(["UTC", "0", "34214400", "63072000"]);
    await expect(
      runtime.eval(
        "x <- ISOdate(c(1970, NA, 1970), 1, c(1, 1, 32), hour = 0)\nc(x[1], is.na(x[2:3]))",
      ),
    ).resolves.toEqual([0, 1, 1]);
    await expect(
      runtime.eval(
        'x <- ISOdate(numeric(), 1, 1)\nc(typeof(x), length(x), class(x), attr(x, "tzone"))',
      ),
    ).resolves.toEqual(["integer", "0", "POSIXct", "POSIXt", "GMT"]);
    await expect(
      runtime.eval('ISOdate(1970, 1, 1, tz = "America/New_York")'),
    ).rejects.toMatchObject({ code: "NRU6141" });

    await expect(
      runtime.eval(
        'g <- expand.grid(x = c("b", "a"), y = 1:3)\na <- attr(g, "out.attrs")\nc(names(g), as.character(g$x), g$y, levels(g$x), nrow(g), a$dim, unlist(a$dimnames))',
      ),
    ).resolves.toEqual([
      "x",
      "y",
      "b",
      "a",
      "b",
      "a",
      "b",
      "a",
      "1",
      "1",
      "2",
      "2",
      "3",
      "3",
      "b",
      "a",
      "6",
      "2",
      "3",
      "x=b",
      "x=a",
      "y=1",
      "y=2",
      "y=3",
    ]);
    await expect(
      runtime.eval(
        'g <- expand.grid(x = c("b", "a"), y = factor(c("u", "v"), levels = c("v", "u")), stringsAsFactors = FALSE, KEEP.OUT.ATTRS = FALSE)\nc(typeof(g$x), g$x, as.integer(g$y), levels(g$y), is.null(attr(g, "out.attrs")))',
      ),
    ).resolves.toEqual(["character", "b", "a", "b", "a", "2", "2", "1", "1", "v", "u", "TRUE"]);
    await expect(
      runtime.eval(
        'g <- expand.grid(list(alpha = 1:2, beta = c("x", "y")), KEEP.OUT.ATTRS = FALSE)\nc(names(g), g$alpha, as.character(g$beta))',
      ),
    ).resolves.toEqual(["alpha", "beta", "1", "2", "1", "2", "x", "x", "y", "y"]);
    await expect(
      runtime.eval(
        "g <- expand.grid(x = integer(), y = 1:2)\nc(nrow(g), ncol(g), attr(g, 'out.attrs')$dim)",
      ),
    ).resolves.toEqual([0, 2, 0, 2]);
    await expect(runtime.eval("c(nrow(expand.grid()), ncol(expand.grid()))")).resolves.toEqual([
      0, 0,
    ]);
    await expect(runtime.eval("expand.grid(x = list(list(1)), y = 1:2)")).rejects.toMatchObject({
      code: "NRT3239",
    });
    await runtime.dispose();
  });

  it("constructs zoo's usage-ranked POSIXct index with deterministic browser timezone rules", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        x <- ISOdatetime(2003, 2, c(1, 3, 7, 9, 14), 0, 0, 0)
        c(unclass(x), class(x), attr(x, "tzone"), typeof(x))
      `),
    ).resolves.toEqual([
      "1044057600",
      "1044230400",
      "1044576000",
      "1044748800",
      "1045180800",
      "POSIXct",
      "POSIXt",
      "",
      "double",
    ]);
    await expect(
      runtime.eval(`
        x <- base::ISOdatetime(
          c(1970, 2000),
          c(1, 2, 3),
          1,
          0,
          c(0, 30),
          c(0.25, 0.5, 0.75),
          tz = "GMT"
        )
        c(unclass(x), attr(x, "tzone"), class(x))
      `),
    ).resolves.toEqual(["0.25", "949365000.5", "5097600.75", "GMT", "POSIXct", "POSIXt"]);
    await expect(
      runtime.eval(`
        x <- ISOdatetime(
          c(0, 1, 9999, 10000, 1970, 1970),
          1,
          c(1, 1, 1, 1, 32, 1),
          c(0, 0, 0, 0, 0, 0.5),
          0,
          c(0.125, 0, 0, 0, 0, 0),
          tz = "UTC"
        )
        c(unclass(x[1:3]), is.na(x[4:6]), attr(x, "tzone"))
      `),
    ).resolves.toEqual([
      "-62167219199.875",
      "-62135596800",
      "253370764800",
      "TRUE",
      "TRUE",
      "TRUE",
      "UTC",
    ]);
    await expect(
      runtime.eval(`
        x <- ISOdatetime(numeric(), 1, 1, 0, 0, 0, tz = "UTC")
        c(typeof(x), length(x), class(x), attr(x, "tzone"))
      `),
    ).resolves.toEqual(["integer", "0", "POSIXct", "POSIXt", "UTC"]);

    for (const source of [
      "ISOdatetime()",
      "ISOdatetime(2000, 1, 1)",
      "ISOdatetime('2000', 1, 1, 0, 0, 0)",
    ]) {
      await expect(runtime.eval(source), source).rejects.toMatchObject({
        code: source.includes("'2000'") ? "NRT3240" : "NRE2103",
      });
    }
    await expect(
      runtime.eval("ISOdatetime(2000, 1, 1, 0, 0, 0, tz = 'America/New_York')"),
    ).rejects.toMatchObject({ code: "NRU6141" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 12 },
    });
    await expect(
      limited.eval("ISOdatetime(2000, 1, 1:13, 0, 0, 0, tz = 'UTC')"),
    ).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("inserts vector values and computes vectorized real and complex cosine", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(append(1:3, c(8L, 9L), after = 0), append(1:3, c(8L, 9L), after = 2), append(1:3, c(8L, 9L)))",
      ),
    ).resolves.toEqual([8, 9, 1, 2, 3, 1, 2, 8, 9, 3, 1, 2, 3, 8, 9]);
    await expect(
      runtime.eval(
        'x <- append(setNames(1:3, c("a", "b", "c")), c(x = 4.5, y = NA), after = 1)\nc(x, names(x), typeof(x))',
      ),
    ).resolves.toEqual(["1", "4.5", NA, "2", "3", "a", "x", "y", "b", "c", "double"]);
    await expect(
      runtime.eval(
        "x <- append(list(a = 1, b = NULL), list(c = 3), after = 1)\nc(names(x), x$a, x$c, is.null(x$b))",
      ),
    ).resolves.toEqual(["a", "c", "b", "1", "3", "TRUE"]);
    await expect(
      runtime.eval(
        'x <- append(factor(c("b", "a"), levels = c("a", "b")), factor("c"), after = 1)\nc(as.integer(x), as.character(x), levels(x), class(x))',
      ),
    ).resolves.toEqual(["2", "3", "1", "b", "c", "a", "a", "b", "c", "factor"]);
    await expect(
      runtime.eval(
        "x <- append(matrix(1:4, 2), 9L, after = 2)\ny <- append(pairlist(a = 1, b = 2), pairlist(c = 3), after = 1)\nc(x, is.null(dim(x)), names(y), unlist(y), append(as.raw(c(1, 2)), as.raw(3), after = 1))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "9",
      "3",
      "4",
      "TRUE",
      "a",
      "c",
      "b",
      "1",
      "3",
      "2",
      "01",
      "03",
      "02",
    ]);
    await expect(
      runtime.eval(
        "x <- append(expression(a, b + 1), expression(c), after = 1)\nc(length(x), deparse(x))",
      ),
    ).resolves.toEqual(["3", "expression(a, c, (b + 1))"]);
    await expect(runtime.eval("append(1:3, 4, after = -1)")).rejects.toMatchObject({
      code: "NRT3242",
    });
    await expect(runtime.eval("append(1:3, 4, after = 1.9)")).rejects.toMatchObject({
      code: "NRT3242",
    });

    await expect(runtime.eval("cos(c(TRUE, FALSE, 0L, 1L))")).resolves.toEqual([
      Math.cos(1),
      1,
      1,
      Math.cos(1),
    ]);
    await expect(
      runtime.eval(
        'x <- structure(matrix(c(0, 1.5707963267948966, NA, NaN), 2), label = "kept")\ny <- cos(x)\nc(typeof(y), dim(y), y[1:2], is.na(y[3]), is.nan(y[4]), attr(y, "label"))',
      ),
    ).resolves.toEqual([
      "double",
      "2",
      "2",
      "1",
      String(Math.cos(Math.PI / 2)),
      "TRUE",
      "TRUE",
      "kept",
    ]);
    const complex = await runtime.eval("cos(1 + 2i)");
    expect(complex).toMatchObject({ __nativr__: "complex" });
    expect((complex as { real: number }).real).toBeCloseTo(2.0327230070196656, 14);
    expect((complex as { imaginary: number }).imaginary).toBeCloseTo(-3.0518977991518, 14);
    const infinite = await runtime.evalDetailed("cos(c(Inf, -Inf))");
    expect(infinite.value).toEqual([Number.NaN, Number.NaN]);
    expect(infinite.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await expect(runtime.eval("cos(factor('a'))")).rejects.toMatchObject({ code: "NRT3241" });
    await expect(runtime.eval("cos(as.raw(1))")).rejects.toMatchObject({ code: "NRT3102" });
    await runtime.dispose();
  });

  it("runs zoo's usage-ranked immutable replace helper through owned subset semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        x <- c(NA, 10, NA, NA, 20, NA)
        result <- replace(x, 1:min(length(x)), 3)
        c(result, x[2], x[5], sum(is.na(x)))
      `),
    ).resolves.toEqual([3, 3, 3, 3, 3, 3, 10, 20, 4]);
    await expect(
      runtime.eval(`
        x <- setNames(1:4, letters[1:4])
        y <- base::replace(x = x, li = c(2, 4), val = c(9L, 8L))
        m <- matrix(1:4, 2, dimnames = list(c("r1", "r2"), c("c1", "c2")))
        z <- replace(m, c(TRUE, FALSE), 0)
        c(y, names(y), typeof(y), z, dim(z), dimnames(z)[[1]], dimnames(z)[[2]])
      `),
    ).resolves.toEqual([
      "1",
      "9",
      "3",
      "8",
      "a",
      "b",
      "c",
      "d",
      "integer",
      "0",
      "2",
      "0",
      "4",
      "2",
      "2",
      "r1",
      "r2",
      "c1",
      "c2",
    ]);
    await expect(
      runtime.eval(`
        x <- list(a = 1, b = 2)
        listed <- replace(x, 1, list("x"))
        deleted <- replace(x, 1, NULL)
        named <- replace(c(a = 1, b = 2), c("b", "c"), c(9, 8))
        pair <- replace(pairlist(a = 1, b = 2), 1, 9)
        c(listed$a, listed$b, names(deleted), named, names(named), pair$a, pair$b, typeof(pair))
      `),
    ).resolves.toEqual(["x", "2", "b", "1", "9", "8", "a", "b", "c", "9", "2", "list"]);
    await expect(
      runtime.eval(`
        f <- replace(factor(c("a", "b", "a")), 2, "a")
        c(as.integer(f), as.character(f), levels(f), class(f),
          replace(NULL, 1, 2), replace(NULL, 1, list(3))[[1]],
          length(replace(NULL, NULL, 2)))
      `),
    ).resolves.toEqual(["1", "1", "1", "a", "a", "a", "a", "b", "factor", "2", "3", "0"]);
    const recycled = await runtime.evalDetailed("replace(1:5, 1:3, 8:9)");
    expect(recycled.value).toEqual([8, 9, 8, 4, 5]);
    expect(recycled.warnings).toEqual([
      {
        code: "NRW1001",
        message: "Longer object length is not a multiple of shorter object length.",
      },
    ]);
    await expect(runtime.eval("replace(1:3, c(-1, 2), 9)")).rejects.toMatchObject({
      code: "NRE2201",
    });
    await expect(runtime.eval("replace(1:3, 1, NULL)")).rejects.toMatchObject({
      code: "NRT3129",
    });
    await expect(runtime.eval("replace(globalenv(), 1, 2)")).rejects.toMatchObject({
      code: "NRT3349",
    });
    await expect(runtime.eval("replace(NULL, 1, quote(a))")).rejects.toMatchObject({
      code: "NRU6166",
    });
    await expect(runtime.eval("replace()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 8 },
    });
    await expect(limited.eval("replace(1, 9, 2)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("computes usage-ranked real and complex tangent values", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(typeof(pi), pi == base::pi)")).resolves.toEqual([
      "double",
      "TRUE",
    ]);
    await expect(runtime.eval("round(tan(pi / 4), 12)")).resolves.toBe(1);
    await expect(runtime.eval("round(tan(pi * (1 / 4 + 1:10)), 12)")).resolves.toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    await expect(
      runtime.eval(
        'x <- structure(matrix(c(0, 1, NA, NaN), 2), marker = "kept")\ny <- tan(x)\nc(typeof(y), dim(y), round(y[1:2], 12), is.na(y[3]), is.nan(y[4]), attr(y, "marker"))',
      ),
    ).resolves.toEqual([
      "double",
      "2",
      "2",
      "0",
      String(Number(Math.tan(1).toFixed(12))),
      "TRUE",
      "TRUE",
      "kept",
    ]);
    await expect(
      runtime.eval("z <- tan(c(0 + 1i, 1 + 2i, -1 - 2i))\nc(round(Re(z), 12), round(Im(z), 12))"),
    ).resolves.toEqual([
      0, 0.03381282608, -0.03381282608, 0.761594155956, 1.014793616147, -1.014793616147,
    ]);
    await expect(
      runtime.eval(
        "z <- tan(complex(real = c(0, 0, NaN), imaginary = c(Inf, -Inf, Inf)))\nc(Re(z), Im(z), is.nan(Re(z)), is.nan(Im(z)))",
      ),
    ).resolves.toEqual([0, 0, 0, 1, -1, 1, 0, 0, 0, 0, 0, 0]);
    const infinite = await runtime.evalDetailed("tan(complex(real = Inf, imaginary = 0))");
    expect(infinite.value).toEqual({
      __nativr__: "complex",
      real: Number.NaN,
      imaginary: Number.NaN,
    });
    expect(infinite.warnings).toEqual([
      { code: "NRW1003", message: 'NaNs produced in function "tan"' },
    ]);
    await expect(runtime.eval("tan(factor('a'))")).rejects.toMatchObject({ code: "NRT3277" });
    await expect(runtime.eval("tan('1')")).rejects.toMatchObject({ code: "NRT3102" });
    await runtime.dispose();
  });

  it("repairs usage-ranked tibble and base names with deterministic C-locale rules", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "tbl <- tibble(x = 1, x = 2, .name_repair = ~ make.names(., unique = TRUE))\nc(names(tbl), unlist(tbl))",
      ),
    ).resolves.toEqual(["x", "x.1", "1", "2"]);
    await expect(
      runtime.eval(
        'c(make.names(c("a and b", "a-and-b"), unique = TRUE), make.names(c("a and b", "a_and_b"), unique = TRUE), make.names(c("a and b", "a_and_b"), unique = TRUE, allow_ = FALSE), make.names(c("", "X"), unique = TRUE))',
      ),
    ).resolves.toEqual([
      "a.and.b",
      "a.and.b.1",
      "a.and.b",
      "a_and_b",
      "a.and.b",
      "a.and.b.1",
      "X.1",
      "X",
    ]);
    await expect(
      runtime.eval(
        'make.names(c("", ".", "...", "..1", ".2way", "2way", "if", "TRUE", "NA_real_", "Inf", "_x", "a+b", "a_b", NA_character_))',
      ),
    ).resolves.toEqual([
      "X",
      ".",
      "...",
      "..1",
      "X.2way",
      "X2way",
      "if.",
      "TRUE.",
      "NA_real_.",
      "Inf.",
      "X_x",
      "a.b",
      "a_b",
      "NA.",
    ]);
    await expect(
      runtime.eval(
        'make.names(c("", "X", "X", "a-b", "a.b", "a b", "if", "if.", "if"), unique = TRUE)',
      ),
    ).resolves.toEqual(["X.2", "X", "X.1", "a.b.1", "a.b", "a.b.2", "if..1", "if.", "if..2"]);
    await expect(
      runtime.eval(
        'c(make.names(1:3), make.names(c(TRUE, FALSE, NA)), make.names(factor(c("a b", "a-b"))), make.names(list("a b", 2, TRUE, NA)))',
      ),
    ).resolves.toEqual([
      "X1",
      "X2",
      "X3",
      "TRUE.",
      "FALSE.",
      "NA.",
      "a.b",
      "a.b",
      "a.b",
      "X2",
      "TRUE.",
      "NA.",
    ]);
    await expect(
      runtime.eval(
        'x <- make.names(structure(c(first = "a b", second = "if"), marker = "kept"))\nc(x, is.null(attributes(x)), length(make.names(character())), make.names(c("é", "λ", "Ångström", "aé")))',
      ),
    ).resolves.toEqual(["a.b", "if.", "TRUE", "0", "X..", "X..", "X..ngstr..m", "a.."]);
    await expect(runtime.eval("make.names('a', unique = c(TRUE, FALSE))")).rejects.toMatchObject({
      code: "NRT3278",
    });
    await expect(runtime.eval("make.names('a', unique = NA)")).rejects.toMatchObject({
      code: "NRT3278",
    });
    await expect(runtime.eval("make.names('a', allow_ = NA)")).rejects.toMatchObject({
      code: "NRT3278",
    });
    await runtime.dispose();
  });

  it("implements stable set operations across atomic vectors, factors, and lists", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(intersect(c(3L, 1L, 3L, 2L), c(2L, 3L, 4L)), setdiff(c(3L, 1L, 3L, 2L), c(2L, 4L)), union(c(3L, 1L, 3L), c(2L, 3L, 4L)))",
      ),
    ).resolves.toEqual([3, 2, 3, 1, 3, 1, 2, 4]);
    await expect(
      runtime.eval(
        'i <- intersect(1:3, c(2, 3.5))\nd <- setdiff(1:3, c(2, 3.5))\nu <- union(c("1", "a"), c(1, 2))\nc(i, typeof(i), d, typeof(d), u)',
      ),
    ).resolves.toEqual(["2", "double", "1", "3", "integer", "1", "a", "2"]);
    await expect(runtime.eval("union(c(NA, NaN, Inf), c(NaN, NA, -Inf))")).resolves.toEqual([
      NA,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]);
    await expect(
      runtime.eval(
        'f <- union(factor(c("b", "a")), factor(c("b", "c")))\nc(as.integer(f), levels(f), class(f), union(factor(c("1", "a")), c("a", "b")))',
      ),
    ).resolves.toEqual(["2", "1", "3", "a", "b", "c", "factor", "1", "a", "b"]);
    await expect(
      runtime.eval('intersect(list(1, "a", 1, NULL), list(NULL, 1, 2))'),
    ).resolves.toEqual([1, null]);
    await expect(runtime.eval("union(data.frame(a = 1:2), data.frame(a = 2:3))")).resolves.toEqual([
      [1, 2],
      [2, 3],
    ]);
    await expect(
      runtime.eval("m <- union(matrix(1:2, 1), matrix(2:3, 1)); c(m, is.null(dim(m)))"),
    ).resolves.toEqual([1, 2, 3, 1]);
    await expect(runtime.eval("union(pairlist(a = 1), pairlist(b = 2))")).rejects.toMatchObject({
      code: "NRT3243",
    });
    await runtime.dispose();
  });

  it("compares vector and measured data-frame sets without order or duplicate sensitivity", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'c(setequal(c(1L, 2L, 2L, NA, NaN), c(NaN, 2, 1, NA)), !setequal(NA, NaN), setequal(1:2, c("2", "1")), !setequal(1:2, c(1, 3)), setequal(factor(c("a", "b")), factor(c("b", "a"), levels = c("b", "a", "z"))), setequal(factor(c("a", "b")), c("b", "a")), setequal(list(1L, "a", 1L), list("a", 1)), !setequal(list(c(1, 2)), list(c(2, 1))), setequal(NULL, integer()), setequal(NULL, list()))',
      ),
    ).resolves.toEqual([true, true, true, true, true, true, true, true, true, true]);
    await expect(
      runtime.eval(
        "df1 <- tibble(x = 1:3)\ndf2 <- tibble(x = 3:5)\na <- data.frame(left = c(1, 1), right = c('x', 'x'))\nb <- data.frame(right = 'x', left = 1)\nc(!setequal(df1, df2), setequal(df1, df1[3:1, ]), setequal(a, b))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(runtime.eval("setequal(pairlist(a = 1), pairlist(a = 1))")).rejects.toMatchObject({
      code: "NRT3243",
    });
    await runtime.dispose();
  });

  it("computes parallel minima with recycling, missingness, and first-input metadata", async () => {
    const runtime = await session();
    await expect(runtime.eval("pmin(c(3L, 1L, 4L), c(2L, 5L, 0L))")).resolves.toEqual([2, 1, 0]);
    await expect(
      runtime.eval(
        'c(pmin(c(TRUE, FALSE), c(TRUE, TRUE)), typeof(pmin(c(TRUE, FALSE), c(TRUE, TRUE))), pmin(1:3, c(2, 1.5, 4)), pmin(c("b", "a"), c("a", "c")), pmin(1:2, c("0", "3")))',
      ),
    ).resolves.toEqual(["1", "0", "integer", "1", "1.5", "3", "a", "a", "0", "2"]);
    await expect(runtime.eval("pmin(c(1, NA, NaN, Inf), c(2, 3, 4, -Inf))")).resolves.toEqual([
      1,
      NA,
      Number.NaN,
      Number.NEGATIVE_INFINITY,
    ]);
    await expect(
      runtime.eval("pmin(c(1, NA, NaN, Inf), c(2, 3, 4, -Inf), na.rm = TRUE)"),
    ).resolves.toEqual([1, 3, 4, Number.NEGATIVE_INFINITY]);
    await expect(
      runtime.eval(
        "x <- structure(matrix(c(3, 1, 4, 2), 2), dimnames = list(c('r1', 'r2'), c('a', 'b')), label = 'x')\ny <- pmin(x, c(2, 5, 0, 9))\nc(y, dim(y), rownames(y), colnames(y), attr(y, 'label'))",
      ),
    ).resolves.toEqual(["2", "1", "0", "2", "2", "2", "r1", "r2", "a", "b", "x"]);
    await expect(
      runtime.eval(
        "x <- pmin(ordered(c('b', 'a')), ordered(c('a', 'b')))\nc(as.integer(x), class(x), levels(x))",
      ),
    ).resolves.toEqual(["1", "1", "ordered", "factor", "a", "b"]);
    const factor = await runtime.evalDetailed(
      "as.character(pmin(factor(c('b', 'a')), factor(c('a', 'b'))))",
    );
    expect(factor.value).toEqual(["b", "a"]);
    expect(factor.warnings).toEqual([
      { code: "NRW1011", message: "'>' not meaningful for factors" },
    ]);
    const recycled = await runtime.evalDetailed("pmin(1:3, c(10L, 2L))");
    expect(recycled.value).toEqual([1, 2, 3]);
    expect(recycled.warnings).toEqual([
      { code: "NRW1001", message: "an argument will be fractionally recycled" },
    ]);
    await expect(
      runtime.eval("c(typeof(pmin(integer(), 1:3)), length(pmin(NULL, 1:3)), is.null(pmin(NULL)))"),
    ).resolves.toEqual(["integer", "0", "TRUE"]);
    await expect(runtime.eval("pmin()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("pmin(as.raw(1), as.raw(2))")).rejects.toMatchObject({
      code: "NRT3244",
    });
    await expect(runtime.eval("pmin(list(1), list(2))")).rejects.toMatchObject({
      code: "NRT3244",
    });
    await runtime.dispose();
  });

  it("computes lagged differences across vectors, matrices, dates, and time series", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(diff(1:5), diff(c(1L, 4L, 9L, 16L), lag = 2L), diff(c(1L, 4L, 9L, 16L), differences = 2L))",
      ),
    ).resolves.toEqual([1, 1, 1, 1, 8, 12, 2, 2]);
    await expect(
      runtime.eval(
        "z <- diff(c(1 + 2i, 3 + 1i, 2 + 4i))\nc(Re(z), Im(z), typeof(diff(c(TRUE, FALSE, TRUE))))",
      ),
    ).resolves.toEqual(["2", "-1", "-1", "3", "integer"]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 1L, b = 4L, c = 9L, d = 16L), tag = 'x')\ny <- diff(x, differences = 2L)\nc(y, names(y), is.null(attr(y, 'tag')))",
      ),
    ).resolves.toEqual(["2", "2", "c", "d", "TRUE"]);

    await expect(
      runtime.eval(
        "x <- matrix(1:12, 4, dimnames = list(c('r1', 'r2', 'r3', 'r4'), c('a', 'b', 'c')))\ny <- diff(x, lag = 2L)\nc(y, dim(y), rownames(y), colnames(y))",
      ),
    ).resolves.toEqual(["2", "2", "2", "2", "2", "2", "2", "3", "r3", "r4", "a", "b", "c"]);
    await expect(runtime.eval("dim(diff(matrix(1:6, 2), lag = 2L))")).resolves.toEqual([0, 3]);

    await expect(
      runtime.eval(
        "d <- diff(structure(c(a = 18262, b = 18264, c = 18267), class = 'Date'))\np <- diff(structure(c(a = 0, b = 60, c = 180), class = c('POSIXct', 'POSIXt')))\nc(d, class(d), attr(d, 'units'), names(d), p, class(p), attr(p, 'units'), names(p))",
      ),
    ).resolves.toEqual([
      "2",
      "3",
      "difftime",
      "days",
      "b",
      "c",
      "1",
      "2",
      "difftime",
      "mins",
      "b",
      "c",
    ]);
    await expect(
      runtime.eval(
        "s <- diff(structure(c(0, 1, 3), class = c('POSIXct', 'POSIXt')))\nh <- diff(structure(c(0, 3600, 10800), class = c('POSIXct', 'POSIXt')))\nd <- diff(structure(c(0, 86400, 259200), class = c('POSIXct', 'POSIXt')))\nc(s, attr(s, 'units'), h, attr(h, 'units'), d, attr(d, 'units'))",
      ),
    ).resolves.toEqual(["1", "2", "secs", "1", "2", "hours", "1", "2", "days"]);
    await expect(
      runtime.eval(
        "x <- structure(c(1, 4, 9, 16), tsp = c(2000.25, 2001, 4), class = 'ts')\ny <- diff(x, lag = 2L)\nc(y, attr(y, 'tsp'), class(y))",
      ),
    ).resolves.toEqual(["8", "12", "2000.75", "2001", "4", "ts"]);
    await expect(
      runtime.eval(
        "f <- diff(factor(c('a', 'b')))\nx <- diff(structure(c(1, 4, 9), class = 'custom', tag = 'x'))\nc(f, class(f), is.null(levels(f)), x, class(x), is.null(attr(x, 'tag')))",
      ),
    ).resolves.toEqual(["1", "factor", "TRUE", "3", "5", "custom", "TRUE"]);

    const overflow = await runtime.evalDetailed("diff(c(-2147483647L, 2147483647L))");
    expect(overflow.value).toEqual(NA);
    expect(overflow.warnings).toEqual([
      { code: "NRW1002", message: "NAs produced by integer overflow." },
    ]);
    await expect(
      runtime.eval(
        "c(length(diff(NULL)), typeof(diff(logical())), length(diff(1:3, lag = 3L)), diff(1:4, ignored = 99))",
      ),
    ).resolves.toEqual(["0", "integer", "0", "1", "1", "1"]);
    await expect(runtime.eval("diff(1:3, lag = 1.5)")).rejects.toMatchObject({
      code: "NRT3245",
    });
    await expect(runtime.eval("diff(1:3, differences = 0L)")).rejects.toMatchObject({
      code: "NRT3245",
    });
    await expect(runtime.eval("diff(c('a', 'b'))")).rejects.toMatchObject({ code: "NRT3245" });
    await runtime.dispose();
  });

  it("shifts time coordinates through frequency-ranked lag semantics and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("x <- lag(c(a = 1, b = 2, c = 3), k = 2)\nc(x, names(x), attr(x, 'tsp'))"),
    ).resolves.toEqual(["1", "2", "3", "a", "b", "c", "-1", "1", "1"]);
    await expect(
      runtime.eval(
        "x <- structure(1:4, tsp = c(2000, 2000.75, 4), class = 'ts')\ny <- lag(x, k = -2)\nc(y, attr(y, 'tsp'), class(y))",
      ),
    ).resolves.toEqual(["1", "2", "3", "4", "2000.5", "2001.25", "4", "ts"]);
    await expect(
      runtime.eval(
        "x <- matrix(1:6, 3, dimnames = list(c('a', 'b', 'c'), c('x', 'y')))\ny <- lag(x)\nc(y, dim(y), rownames(y), colnames(y), attr(y, 'tsp'))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "3",
      "2",
      "a",
      "b",
      "c",
      "x",
      "y",
      "0",
      "2",
      "1",
    ]);
    await expect(
      runtime.eval(
        "x <- structure(list(a = 1, b = 'x'), tag = 'kept')\ny <- lag(x, k = 0)\nc(attr(y, 'tsp'), attr(y, 'tag'), names(y))",
      ),
    ).resolves.toEqual(["1", "2", "1", "kept", "a", "b"]);
    await expect(
      runtime.eval(
        "x <- lag(structure(1:3, class = 'custom', tag = 'kept'))\nc(x, class(x), attr(x, 'tag'), attr(x, 'tsp'))",
      ),
    ).resolves.toEqual(["1", "2", "3", "custom", "kept", "0", "2", "1"]);

    const rounded = await runtime.evalDetailed("x <- lag(1:3, k = 1.9)\nattr(x, 'tsp')");
    expect(rounded.value).toEqual([-1, 1, 1]);
    expect(rounded.warnings).toEqual([{ code: "NRW1018", message: "'k' is not an integer" }]);
    await expect(runtime.eval("attr(lag(1:3, k = Inf), 'tsp')")).resolves.toEqual([
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ]);

    await runtime.eval("lag.custom <- function(x, ..., k = 1) c('custom', as.character(k))\nNULL");
    await expect(runtime.eval("lag(structure(1:3, class = 'custom'), k = 4)")).resolves.toEqual([
      "custom",
      "4",
    ]);
    await expect(runtime.eval("lag(integer())")).rejects.toMatchObject({ code: "NRT3252" });
    await expect(runtime.eval("lag(NULL)")).rejects.toMatchObject({ code: "NRT3252" });
    await expect(runtime.eval("lag(1:3, k = '2')")).rejects.toMatchObject({ code: "NRT3252" });
    await expect(runtime.eval("lag(1:3, k = c(1, 2))")).rejects.toMatchObject({
      code: "NRT3252",
    });
    await runtime.dispose();
  });

  it("reports usage-ranked time-series endpoints with cycle coordinates and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(end(1:5), end(matrix(1:6, 3)), end(array(1:24, c(2, 3, 4))), end(list(1, 2, 3)))",
      ),
    ).resolves.toEqual([5, 1, 3, 1, 2, 1, 3, 1]);
    await expect(
      runtime.eval(
        "c(start(1:5), start(matrix(1:6, 3)), start(array(1:24, c(2, 3, 4))), start(list(1, 2, 3)))",
      ),
    ).resolves.toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    await expect(
      runtime.eval(
        "a <- structure(1:5, tsp = c(2000.25, 2001.25, 4), class = 'ts')\nb <- structure(1:5, tsp = c(1.2, 2.8, 2.5))\nc <- structure(1:5, tsp = c(-1.25, -0.25, 4))\nc(end(a), end(b), end(c))",
      ),
    ).resolves.toEqual([2001, 2, 2.8, -1, 4]);
    await expect(
      runtime.eval(
        "a <- structure(1:5, tsp = c(2000.25, 2001.25, 4), class = 'ts')\nb <- structure(1:5, tsp = c(1.2, 2.8, 2.5))\nc <- structure(1:5, tsp = c(-1.25, -0.25, 4))\nc(start(a), start(b), start(c))",
      ),
    ).resolves.toEqual([2000, 2, 1.2, -2, 4]);
    await expect(
      runtime.eval(
        "x <- structure(1:5, tsp = c(1, 2.00000001, 4))\nc(end(x, ts.eps = 0), end(x, ts.eps = 1e-6))",
      ),
    ).resolves.toEqual([2.00000001, 2, 1]);
    await expect(
      runtime.eval(
        "x <- structure(1:5, tsp = c(1.00000001, 2.00000001, 4))\nc(start(x, ts.eps = 0), start(x, ts.eps = 1e-6))",
      ),
    ).resolves.toEqual([1.00000001, 1, 1]);
    await expect(runtime.eval("getOption('ts.eps')")).resolves.toBeCloseTo(
      Math.sqrt(Number.EPSILON),
    );
    await runtime.eval(
      "end.custom <- function(x, ..., marker = 'default') c(marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval("end(structure(1:3, class = 'custom'), marker = 'ok', extra = 'dot')"),
    ).resolves.toEqual(["ok", "dot"]);
    await runtime.eval(
      "start.custom <- function(x, ..., marker = 'default') c(marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval("start(structure(1:3, class = 'custom'), marker = 'ok', extra = 'dot')"),
    ).resolves.toEqual(["ok", "dot"]);
    await expect(runtime.eval("end(integer())")).rejects.toMatchObject({ code: "NRT3258" });
    await expect(runtime.eval("start(integer())")).rejects.toMatchObject({ code: "NRT3258" });
    await expect(runtime.eval("end(data.frame(x = 1:3))")).rejects.toMatchObject({
      code: "NRT3258",
    });
    await expect(runtime.eval("start(data.frame(x = 1:3))")).rejects.toMatchObject({
      code: "NRT3258",
    });
    await expect(runtime.eval("end(structure(1:3, tsp = c(1, 2, 4)))")).rejects.toMatchObject({
      code: "NRT3258",
    });
    await expect(runtime.eval("start(structure(1:3, tsp = c(1, 2, 4)))")).rejects.toMatchObject({
      code: "NRT3258",
    });
    await runtime.dispose();
  });

  it("returns usage-ranked sampling times with regular-series coordinates and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "uspop <- structure(1:19, tsp = c(1790, 1970, .1), class = 'ts')\nas.integer(time(uspop))",
      ),
    ).resolves.toEqual([
      1790, 1800, 1810, 1820, 1830, 1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930,
      1940, 1950, 1960, 1970,
    ]);
    await expect(
      runtime.eval(
        "a <- time(1:3)\nb <- time(matrix(1:6, 3), offset = .5)\nc(a, attr(a, 'tsp'), b, attr(b, 'tsp'))",
      ),
    ).resolves.toEqual([1, 2, 3, 1, 3, 1, 1.5, 2.5, 3.5, 1, 3, 1]);
    await expect(
      runtime.eval(
        "x <- structure(1:5, tsp = c(2000.25, 2001.25, 4), class = 'ts')\na <- time(x)\nb <- time(x, offset = 1)\nc(a, attr(a, 'tsp'), class(a), b)",
      ),
    ).resolves.toEqual([
      "2000.25",
      "2000.5",
      "2000.75",
      "2001",
      "2001.25",
      "2000.25",
      "2001.25",
      "4",
      "ts",
      "2000.5",
      "2000.75",
      "2001",
      "2001.25",
      "2001.5",
    ]);
    await expect(
      runtime.eval(
        "x <- structure(1:3, tsp = c(1.00000001, 3.00000001, 1), class = 'ts')\nc(time(x, ts.eps = 0), time(x, ts.eps = 1e-6))",
      ),
    ).resolves.toEqual([1.00000001, 2.00000001, 3.00000001, 1, 2, 3]);
    await runtime.eval(
      "time.zoo <- function(x, ..., marker = 'default') c(attr(x, 'index'), marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval(
        "time(structure(1:3, class = 'zoo', index = c(4, 7, 9)), marker = 'ok', extra = 'dot')",
      ),
    ).resolves.toEqual(["4", "7", "9", "ok", "dot"]);
    await expect(runtime.eval("time(integer())")).rejects.toMatchObject({ code: "NRT3284" });
    await expect(runtime.eval("time(data.frame(x = 1:3))")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await expect(runtime.eval("time(1:3, offset = Inf)")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await runtime.dispose();
  });

  it("constructs and coerces usage-ranked regular time series", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- stats::ts(1:10, frequency = 4, start = c(1959, 2))\nc(x, attr(x, 'tsp'), class(x), frequency(x))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "1959.25",
      "1961.5",
      "4",
      "ts",
      "4",
    ]);
    await expect(
      runtime.eval(
        "x <- ts(1:3, start = 2000, end = 2001, frequency = 4)\nm <- ts(matrix(1:6, 3, 2), start = 2000, end = 2001, frequency = 4)\nc(x, attr(x, 'tsp'), dim(m), m, colnames(m), class(m))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "1",
      "2",
      "2000",
      "2001",
      "4",
      "5",
      "2",
      "1",
      "2",
      "3",
      "1",
      "2",
      "4",
      "5",
      "6",
      "4",
      "5",
      "Series 1",
      "Series 2",
      "mts",
      "ts",
      "matrix",
      "array",
    ]);
    await expect(
      runtime.eval(
        "a <- as.ts(c(a = 10, b = 20, c = 30))\nb <- as.ts(structure(1:3, tsp = c(2000, 2001, 2), class = 'custom'))\nc(a, names(a), attr(a, 'tsp'), class(a), b, attr(b, 'tsp'), class(b))",
      ),
    ).resolves.toEqual([
      "10",
      "20",
      "30",
      "a",
      "b",
      "c",
      "1",
      "3",
      "1",
      "ts",
      "1",
      "2",
      "3",
      "2000",
      "2001",
      "2",
      "ts",
    ]);
    await expect(runtime.eval("ts(numeric())")).rejects.toMatchObject({ code: "NRT3284" });
    await expect(runtime.eval("ts(1:3, frequency = -1)")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await expect(runtime.eval("as.ts(data.frame(x = 1:3))")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await runtime.dispose();
  });

  it("computes zoo's usage-ranked regular-series cycles with S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        x <- stats::ts(1:10, frequency = 4, start = c(1959, 2))
        y <- stats::cycle(x)
        c(y, attr(y, "tsp"), class(y))
      `),
    ).resolves.toEqual([
      "2",
      "3",
      "4",
      "1",
      "2",
      "3",
      "4",
      "1",
      "2",
      "3",
      "1959.25",
      "1961.5",
      "4",
      "ts",
    ]);
    await expect(
      runtime.eval(`
        plain <- cycle(1:5)
        matrixCycle <- cycle(matrix(1:12, 6, 2))
        multi <- cycle(ts(matrix(1:12, 6, 2), start = c(2000, 3), frequency = 4))
        fractional <- cycle(ts(1:6, start = 1.2, frequency = 2.5))
        c(
          plain,
          attr(plain, "tsp"),
          is.null(class(plain)),
          matrixCycle,
          attr(matrixCycle, "tsp"),
          multi,
          class(multi),
          fractional
        )
      `),
    ).resolves.toEqual([
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "5",
      "1",
      "FALSE",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "6",
      "1",
      "3",
      "4",
      "1",
      "2",
      "3",
      "4",
      "ts",
      "1",
      "2",
      "3",
      "1.5",
      "2.5",
      "1",
    ]);
    await expect(
      runtime.eval("x <- cycle(expression(a, b))\nc(x, attr(x, 'tsp'))"),
    ).resolves.toEqual([1, 1, 1, 2, 1]);
    await runtime.eval(`
      cycle.zoo <- function(x, ..., marker = "default") {
        c(marker, attr(x, "index"), list(...)$extra)
      }
      NULL
    `);
    await expect(
      runtime.eval(
        "cycle(structure(1:3, class = 'zoo', index = c(4, 7, 9)), marker = 'ok', extra = 'dot')",
      ),
    ).resolves.toEqual(["ok", "4", "7", "9", "dot"]);
    await expect(runtime.eval("cycle(1:3, stop('dots stay lazy'))")).resolves.toEqual([1, 1, 1]);
    await expect(runtime.eval("cycle(integer())")).rejects.toMatchObject({ code: "NRT3284" });
    await expect(runtime.eval("cycle(data.frame(x = 1:3))")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await expect(runtime.eval("cycle(structure(1:3, tsp = c(1, 2, 4)))")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 8 },
    });
    await expect(limited.eval("cycle(1:10)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("computes zoo's usage-ranked sampling interval with S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        c(
          stats::deltat(1:3),
          deltat(matrix(1:6, 2)),
          deltat(NULL),
          deltat(expression(a, b)),
          deltat(function() 1),
          deltat(ts(1:5, start = c(2000, 2), frequency = 4)),
          deltat(structure(1:3, tsp = c(2, 3, 2)))
        )
      `),
    ).resolves.toEqual([1, 1, 1, 1, 1, 0.25, 0.5]);
    await expect(
      runtime.eval(`
        deltat.zoo <- function(x, ..., marker = "default") {
          c(marker, attr(x, "frequency"), list(...)$extra)
        }
        deltat(
          structure(1:3, class = "zoo", frequency = 4),
          marker = "measured",
          extra = "dot"
        )
      `),
    ).resolves.toEqual(["measured", "4", "dot"]);
    await expect(runtime.eval("deltat(1:3, stop('dots stay lazy'))")).resolves.toBe(1);
    await expect(
      runtime.eval(`
        interval <- deltat(ts(1:3, frequency = 4))
        visible <- withVisible(deltat(ts(1:3)))
        c(typeof(interval), length(interval), is.null(names(interval)), visible$visible)
      `),
    ).resolves.toEqual(["double", "1", "TRUE", "TRUE"]);
    await expect(runtime.eval("deltat()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("deltat(structure(1:3, tsp = c(1, 2, 4)))")).rejects.toMatchObject({
      code: "NRT3284",
    });
    await runtime.dispose();
  });

  it("embeds zoo's usage-ranked lagged windows in GNU R column-major order", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        y <- stats::embed(setNames(1:5, letters[1:5]), 3)
        c(dim(y), y, is.null(dimnames(y)), is.null(names(y)), typeof(y), class(y))
      `),
    ).resolves.toEqual([
      "3",
      "3",
      "3",
      "4",
      "5",
      "2",
      "3",
      "4",
      "1",
      "2",
      "3",
      "TRUE",
      "TRUE",
      "integer",
      "matrix",
      "array",
    ]);

    const matrix = await runtime.evalDetailed(`
      x <- matrix(
        1:12,
        4,
        3,
        dimnames = list(paste0("r", 1:4), paste0("c", 1:3))
      )
      embed(x, 2)
    `);
    expect(matrix.value).toEqual([2, 3, 4, 6, 7, 8, 10, 11, 12, 1, 2, 3, 5, 6, 7, 9, 10, 11]);
    expect(matrix.raw).toMatchObject({ type: "double", dim: [3, 6] });
    await expect(runtime.eval("is.null(dimnames(embed(matrix(1:12, 4), 2)))")).resolves.toBe(true);

    await expect(
      runtime.eval(`
        c(
          typeof(embed(c(TRUE, FALSE, NA), 2)),
          typeof(embed(c(1, NA, NaN), 2)),
          typeof(embed(c(1 + 2i, 3 + 4i), 1)),
          typeof(embed(as.raw(1:3), 2)),
          typeof(embed(c("a", "b"), 1)),
          typeof(embed(matrix(c(TRUE, FALSE), 2), 1))
        )
      `),
    ).resolves.toEqual(["logical", "double", "complex", "raw", "character", "double"]);
    await expect(
      runtime.eval(`
        y <- embed(c(1, NA, NaN, 4), 2)
        c(is.na(y), is.nan(y))
      `),
    ).resolves.toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
    await expect(
      runtime.eval(`
        f <- structure(factor(c("a", "b", "a", "b")), dim = c(2, 2))
        y <- embed(f, 1)
        c(y, typeof(y), is.null(attr(y, "class")))
      `),
    ).resolves.toEqual(["a", "b", "a", "b", "character", "TRUE"]);
    await expect(
      runtime.eval(`
        y <- embed(list(1L, "x", TRUE), 2)
        c(dim(y), unlist(y), typeof(y))
      `),
    ).resolves.toEqual(["2", "2", "x", "TRUE", "1", "x", "list"]);
    await expect(
      runtime.eval(`
        y <- embed(ts(1:5, start = c(2000, 2), frequency = 4), 3)
        c(is.null(attr(y, "tsp")), is.null(attr(y, "class")), dim(y))
      `),
    ).resolves.toEqual([1, 1, 3, 3]);
    await expect(runtime.eval("dim(embed(1:5))")).resolves.toEqual([5, 1]);
    await expect(runtime.eval("dim(embed(1:5, 2.9))")).resolves.toEqual([3, 2]);
    await expect(runtime.eval("dim(embed(1:5, TRUE))")).resolves.toEqual([5, 1]);
    await expect(runtime.eval("dim(embed(matrix(integer(), 3, 0)))")).resolves.toEqual([3, 0]);

    for (const source of [
      "embed()",
      "embed(integer())",
      "embed(1:3, 0)",
      "embed(1:3, 4)",
      "embed(1:3, numeric())",
      "embed(1:3, NA_real_)",
      "embed(1:3, Inf)",
      "embed(matrix(1:6, 3), 1.9)",
      "embed(factor(c('a', 'b')))",
      "embed(data.frame(x = 1:3))",
      "embed(structure(1:3, class = 'probe'))",
      "embed(expression(a, b))",
      "embed(matrix(as.raw(1:4), 2))",
      "embed(matrix(list(1, 2, 3, 4), 2))",
    ]) {
      await expect(runtime.eval(source), source).rejects.toMatchObject({
        code: source === "embed()" ? "NRE2103" : "NRT3346",
      });
    }
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 12 },
    });
    await expect(limited.eval("embed(1:10, 3)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("finds zoo's usage-ranked irregular Date window widths with bounded binary search", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        tt <- as.Date("2000-01-01") + c(1, 2, 5, 6, 7, 8, 10)
        intervals <- findInterval(tt - 3, tt)
        c(intervals, seq_along(tt) - intervals)
      `),
    ).resolves.toEqual([0, 0, 2, 2, 2, 3, 5, 1, 2, 1, 2, 3, 3, 2]);

    await expect(
      runtime.eval(`
        x <- c(-Inf, 4, 5, 7, 10, 15, Inf, NA, NaN)
        v <- c(5, 10, 15)
        c(
          findInterval(x, v),
          findInterval(x, v, left.open = TRUE),
          findInterval(x, v, rightmost.closed = TRUE),
          findInterval(x, v, all.inside = TRUE)
        )
      `),
    ).resolves.toEqual([
      0,
      0,
      1,
      1,
      2,
      3,
      3,
      NA,
      NA,
      0,
      0,
      0,
      1,
      1,
      2,
      3,
      NA,
      NA,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      NA,
      NA,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      NA,
      NA,
    ]);
    await expect(
      runtime.eval(`
        x <- c(-Inf, 0, 5, 10, Inf)
        v <- c(5, 5, 10, 10)
        c(
          findInterval(x, v),
          findInterval(x, v, rightmost.closed = TRUE),
          findInterval(x, v, left.open = TRUE),
          findInterval(x, v, left.open = TRUE, rightmost.closed = TRUE)
        )
      `),
    ).resolves.toEqual([0, 0, 2, 4, 4, 0, 0, 2, 3, 4, 0, 0, 0, 2, 4, 0, 0, 1, 2, 4]);
    await expect(
      runtime.eval(`
        c(
          findInterval(c(-Inf, 0, 5, 10, Inf), 5, all.inside = TRUE),
          findInterval(1:3, numeric()),
          length(findInterval(NULL, 1:3)),
          findInterval(c("1", "2"), "1.5"),
          findInterval(10, c(5, 10), rightmost.closed = "TRUE"),
          findInterval(1:3, 1:3, checkSorted = FALSE, checkNA = FALSE)
        )
      `),
    ).resolves.toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 3]);
    await expect(
      runtime.eval(`
        y <- findInterval(structure(matrix(1:4, 2), marker = "drop"), c(1, 3))
        c(y, typeof(y), is.null(attributes(y)))
      `),
    ).resolves.toEqual(["1", "1", "2", "2", "integer", "TRUE"]);

    for (const source of [
      "findInterval()",
      "findInterval(1)",
      "findInterval(1:3, c(2, 1))",
      "findInterval(1:3, c(1, NA_real_))",
      "findInterval(1:3, list(1, 2))",
      "findInterval(1, 0, rightmost.closed = logical())",
      "findInterval(1, 0, all.inside = NA)",
      "findInterval(1, 0, left.open = c(FALSE, TRUE))",
    ]) {
      await expect(runtime.eval(source), source).rejects.toMatchObject({
        code: source === "findInterval()" || source === "findInterval(1)" ? "NRE2103" : "NRT3347",
      });
    }
    await runtime.dispose();
  });

  it("extracts usage-ranked regular windows and exposes package-owned S3 seams", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- ts(1:10, start = c(1959, 2), frequency = 4)\ny <- stats::window(x, start = 1960, end = 1961)\nc(y, attr(y, 'tsp'), class(y), frequency(y))",
      ),
    ).resolves.toEqual(["4", "5", "6", "7", "8", "1960", "1961", "4", "ts", "4"]);
    await expect(
      runtime.eval(
        "x <- window(ts(1:12, start = 2000, frequency = 4), start = c(2000, 3), deltat = 1)\nc(x, attr(x, 'tsp'), class(x))",
      ),
    ).resolves.toEqual(["3", "7", "11", "2000.5", "2002.5", "1", "ts"]);
    await expect(
      runtime.eval(
        "x <- window(ts(1:4, start = 2000, frequency = 4), start = c(1999, 4), end = c(2001, 1), extend = TRUE)\nc(x, attr(x, 'tsp'))",
      ),
    ).resolves.toEqual([NA, 1, 2, 3, 4, NA, 1999.75, 2001, 4]);

    await runtime.eval(
      "as.ts.zoo <- function(x, ..., marker = 'a') c(marker, attr(x, 'index'))\nfrequency.zoo <- function(x, ...) 12\nwindow.zoo <- function(x, ..., marker = 'w') c(marker, attr(x, 'index'))\nNULL",
    );
    await expect(
      runtime.eval(
        "x <- structure(1:3, class = 'zoo', index = c(4, 7, 9))\nc(as.ts(x, marker = 'as'), frequency(x), window(x, marker = 'win'))",
      ),
    ).resolves.toEqual(["as", "4", "7", "9", "12", "win", "4", "7", "9"]);

    const bounded = await runtime.evalDetailed(
      "window(ts(1:4, start = 2000, frequency = 4), start = 1999, end = 2002)",
    );
    expect(bounded.value).toEqual([1, 2, 3, 4]);
    expect(bounded.warnings).toEqual([
      { code: "NRW1026", message: "'start' value not changed" },
      { code: "NRW1027", message: "'end' value not changed" },
    ]);
    const incompatible = await runtime.evalDetailed(
      "window(ts(1:4, start = 2000, frequency = 4), frequency = 8)",
    );
    expect(incompatible.value).toEqual([1, 2, 3, 4]);
    expect(incompatible.warnings).toEqual([
      { code: "NRW1025", message: "'frequency' not changed" },
    ]);
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 8 },
    });
    await expect(limited.eval("ts(1, start = 1, end = 100)")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await expect(
      limited.eval("window(ts(1:2), start = -100, end = 100, extend = TRUE)"),
    ).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("omits usage-ranked incomplete cases with row metadata and S3 boundaries", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- setNames(c(1, NA, NaN, 4), c('a', 'b', 'c', 'd'))\ny <- na.omit(x)\na <- attr(y, 'na.action')\nc(y, names(y), unclass(a), names(a), class(a))",
      ),
    ).resolves.toEqual(["1", "4", "a", "d", "2", "3", "b", "c", "omit"]);
    await expect(
      runtime.eval(
        "m <- matrix(c(1, NA, 3, 4, 5, NaN, 7, 8), 4, dimnames = list(c('r1', 'r2', 'r3', 'r4'), c('x', 'y')))\ny <- na.omit(m)\na <- attr(y, 'na.action')\nc(dim(y), y, unlist(dimnames(y)), unclass(a), names(a), class(a))",
      ),
    ).resolves.toEqual([
      "3",
      "2",
      "1",
      "3",
      "4",
      "5",
      "7",
      "8",
      "r1",
      "r3",
      "r4",
      "x",
      "y",
      "2",
      "r2",
      "omit",
    ]);
    await expect(
      runtime.eval(
        "d <- structure(data.frame(a = c(1, NA, 3, 4), b = factor(c('x', 'y', NA, 'x')), c = I(c('u', 'v', 'w', NA))), row.names = c('one', 'two', 'three', 'four'))\ny <- na.omit(d)\na <- attr(y, 'na.action')\nc(nrow(y), attr(y, 'row.names'), y$a, as.character(y$b), y$c, levels(y$b), unclass(a), names(a), class(a))",
      ),
    ).resolves.toEqual([
      "1",
      "one",
      "1",
      "x",
      "u",
      "x",
      "y",
      "2",
      "3",
      "4",
      "two",
      "three",
      "four",
      "omit",
    ]);
    await expect(
      runtime.eval(
        "f <- na.omit(factor(c(a = 'x', b = NA, c = 'y')))\nz <- na.omit(structure(c(1, NA, 3), class = 'custom_without_method', marker = 'drop'))\nc(as.character(f), names(f), levels(f), class(f), z, is.null(attr(z, 'class')), is.null(attr(z, 'marker')))",
      ),
    ).resolves.toEqual(["x", "y", "a", "c", "x", "y", "factor", "1", "3", "TRUE", "TRUE"]);
    await expect(
      runtime.eval(
        "a <- array(c(1, NA, 3, 4, 5, 6, 7, 8), c(2, 2, 2))\nc(identical(na.omit(a), a), identical(na.omit(list(1, NA, NaN)), list(1, NA, NaN)), is.null(na.omit(NULL)))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval(
        "x <- structure(c(NA, 2, 3, NA), tsp = c(2000.25, 2001, 4), class = 'ts')\ny <- na.omit(x)\nc(y, attr(y, 'tsp'), unclass(attr(y, 'na.action')), class(attr(y, 'na.action')), class(y))",
      ),
    ).resolves.toEqual(["2", "3", "2000.5", "2000.75", "4", "1", "4", "omit", "ts"]);
    await expect(
      runtime.eval("na.omit(structure(c(1, NA, 3), tsp = c(2000, 2000.5, 4), class = 'ts'))"),
    ).rejects.toThrow(/internal NAs/u);
    await expect(
      runtime.eval("na.omit(structure(c(NA, NA), tsp = c(2000, 2001, 1), class = 'ts'))"),
    ).rejects.toThrow(/all times contain an NA/u);
    await runtime.eval(
      "na.omit.zoo <- function(object, ..., marker = 'default') c(attr(object, 'index'), marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval(
        "na.omit(structure(1:3, class = 'zoo', index = c(4, 7, 9)), marker = 'ok', extra = 'dot')",
      ),
    ).resolves.toEqual(["4", "7", "9", "ok", "dot"]);
    await runtime.dispose();
  });

  it("constructs usage-ranked roman row identifiers through the utils namespace", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- data.frame(a = 1:3)\nrowid <- utils::as.roman(seq_len(nrow(x)))\nc(as.character(rowid), max(nchar(as.character(rowid))), typeof(rowid), class(rowid))",
      ),
    ).resolves.toEqual(["I", "II", "III", "3", "integer", "roman"]);
    await expect(
      runtime.eval(
        "x <- as.roman(c(1, 4, 5, 9, 10, 40, 50, 90, 400, 900, 1999, 4999))\nc(as.character(x), as.integer(x))",
      ),
    ).resolves.toEqual([
      "I",
      "IV",
      "V",
      "IX",
      "X",
      "XL",
      "L",
      "XC",
      "CD",
      "CM",
      "MCMXCIX",
      "MMMMCMXCIX",
      "1",
      "4",
      "5",
      "9",
      "10",
      "40",
      "50",
      "90",
      "400",
      "900",
      "1999",
      "4999",
    ]);
    const mixed = await runtime.evalDetailed(
      'as.integer(as.roman(c(NA, 1:3, "", "I", "II", "III", "IIII", "IIIII", "IIIIII", "IIIIIII")))',
    );
    expect(mixed.value).toEqual([NA, 1, 2, 3, NA, 1, 2, 3, 4, 5, 6, NA]);
    expect(mixed.warnings).toEqual([
      { code: "NRW1111", message: "invalid roman numeral: IIIIIII" },
    ]);
    const numeric = await runtime.evalDetailed(
      "as.integer(as.roman(c(NA_real_, NaN, -Inf, -1, 0, 1.9, 4999, 5000, Inf)))",
    );
    expect(numeric.value).toEqual([NA, NA, NA, NA, NA, 1, 4999, NA, NA]);
    expect(numeric.warnings).toEqual([
      { code: "NRW1110", message: "NAs introduced by coercion to integer range" },
    ]);
    await expect(
      runtime.eval(
        "x <- as.roman(matrix(1:4, 2, dimnames = list(c('r1', 'r2'), c('a', 'b'))))\nc(dim(x), dimnames(x)[[1]], dimnames(x)[[2]], format(as.roman(c(1, 5, NA)), width = 3), identical(as.roman(x), x))",
      ),
    ).resolves.toEqual(["2", "2", "r1", "r2", "a", "b", "I  ", "V  ", "NA ", "TRUE"]);
    await expect(runtime.eval("as.roman(factor(c('I', 'V')))")).rejects.toMatchObject({
      code: "NRT3273",
    });
    await runtime.dispose();
  });

  it("decomposes usage-ranked UTC date-times into POSIXlt components", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "fixed <- as.POSIXct(c('1970-01-01 00:00:00', '2000-02-29 12:34:56', '2024-12-31 23:59:59'), tz = 'UTC')\nx <- as.POSIXlt(fixed, tz = 'UTC')\nc(x$sec, x$min, x$hour, x$mday, x$mon, x$year, x$wday, x$yday, x$isdst, x$gmtoff)",
      ),
    ).resolves.toEqual([
      0, 56, 59, 0, 34, 59, 0, 12, 23, 1, 29, 31, 0, 1, 11, 70, 100, 124, 4, 2, 2, 0, 59, 365, 0, 0,
      0, 0, 0, 0,
    ]);
    await expect(
      runtime.eval(
        "x <- as.POSIXlt(Sys.time())\nc(length(x), class(x), names(unclass(x)), attr(x, 'tzone'), attr(x, 'balanced'), is.null(names(x)))",
      ),
    ).resolves.toEqual([
      "1",
      "POSIXlt",
      "POSIXt",
      "sec",
      "min",
      "hour",
      "mday",
      "mon",
      "year",
      "wday",
      "yday",
      "isdst",
      "zone",
      "gmtoff",
      "UTC",
      "TRUE",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "x <- as.POSIXlt(as.Date(c('1970-01-01', '2000-02-29', '2024-12-31')))\nc(x$mday, x$mon, x$year, x$wday, x$yday, x$isdst, x$gmtoff)",
      ),
    ).resolves.toEqual([1, 29, 31, 0, 1, 11, 70, 100, 124, 4, 2, 2, 0, 59, 365, 0, 0, 0, 0, 0, 0]);
    await expect(
      runtime.eval(
        "x <- as.POSIXlt(as.POSIXct('2000-02-29 12:34:56', tz = 'UTC') + 0.25, tz = 'UTC')\nc(x$sec, x$min, x$hour, x$mday, x$mon, x$year, x$zone, x$gmtoff)",
      ),
    ).resolves.toEqual(["56.25", "34", "12", "29", "1", "100", "UTC", "0"]);
    await expect(
      runtime.eval(
        "a <- as.POSIXlt(0, tz = 'UTC')\nb <- as.POSIXlt(c('1970-01-01', '2000-02-29 12:34:56'), tz = 'GMT')\nd <- as.POSIXlt(factor('2024-12-31'), tz = 'UTC')\nc(a$mday, a$year, b$mday, b$hour, b$zone, d$mday, d$yday)",
      ),
    ).resolves.toEqual(["1", "70", "1", "29", "0", "12", "GMT", "GMT", "31", "365"]);
    await expect(
      runtime.eval(
        "x <- as.POSIXlt(structure(c(NA_real_, NaN, -Inf, Inf), class = c('POSIXct', 'POSIXt')), tz = 'GMT')\nc(x$sec, x$min, x$isdst, x$zone, x$gmtoff)",
      ),
    ).resolves.toEqual([
      NA,
      "NaN",
      "-Inf",
      "Inf",
      NA,
      NA,
      NA,
      NA,
      "-1",
      "-1",
      "-1",
      "-1",
      "GMT",
      "GMT",
      "GMT",
      "GMT",
      "0",
      "0",
      "0",
      "0",
    ]);
    await runtime.eval(
      "as.POSIXlt.custom <- function(x, ..., marker = 'default') c(marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval("as.POSIXlt(structure(1, class = 'custom'), marker = 'ok', extra = 'dot')"),
    ).resolves.toEqual(["ok", "dot"]);
    await expect(
      runtime.eval("as.POSIXlt(as.POSIXct('2024-01-01', tz = 'UTC'), tz = 'America/New_York')"),
    ).rejects.toMatchObject({ code: "NRU6142" });
    await expect(runtime.eval("as.POSIXlt(TRUE)")).rejects.toMatchObject({ code: "NRT3275" });
    await expect(runtime.eval("as.POSIXlt(list(0))")).rejects.toMatchObject({ code: "NRT3275" });
    await runtime.dispose();
  });

  it("drops usage-ranked singleton array extents while retaining surviving metadata", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- matrix(1:6, 3, 2, dimnames = list(c('r1', 'r2', 'r3'), c('s1', 's2')))\nb <- matrix(1:3, 3, 1, dimnames = list(c('r1', 'r2', 'r3'), 's1'))\nd <- matrix(1:3, 1, 3, dimnames = list('s1', c('c1', 'c2', 'c3')))\nc(identical(drop(a), a), identical(drop(b), setNames(1:3, c('r1', 'r2', 'r3'))), identical(drop(d), setNames(1:3, c('c1', 'c2', 'c3'))))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval(
        "x <- array(1:12, c(1, 3, 1, 1, 2, 1, 2), dimnames = list(singleton.a = 'sa', rows = c('r1', 'r2', 'r3'), singleton.b = 'sb', singleton.c = 'sc', cols = c('c1', 'c2'), singleton.d = 'sd', pages = c('p1', 'p2')))\ny <- drop(x)\nc(dim(y), names(dimnames(y)), dimnames(y)[[1]], dimnames(y)[[2]], dimnames(y)[[3]], class(y))",
      ),
    ).resolves.toEqual([
      "3",
      "2",
      "2",
      "rows",
      "cols",
      "pages",
      "r1",
      "r2",
      "r3",
      "c1",
      "c2",
      "p1",
      "p2",
      "array",
    ]);
    await expect(
      runtime.eval(
        "x <- array(7, c(1, 1), list('a', 'b'))\nx1 <- array(7, c(1, 1), list('a', NULL))\nx2 <- array(7, c(1, 1), list(NULL, 'b'))\nempty <- drop(array(numeric(), c(0, 1), list(character(), 'c')))\nrect <- drop(array(numeric(), c(0, 2, 1)))\nc(is.null(names(drop(x))), names(drop(x1)), names(drop(x2)), is.null(dim(empty)), dim(rect))",
      ),
    ).resolves.toEqual(["TRUE", "a", "b", "TRUE", "0", "2"]);
    await expect(
      runtime.eval(
        "custom <- structure(1:3, dim = c(1, 3), class = 'probe', note = 'keep')\nf <- structure(factor(c('a', 'b')), dim = c(1, 2))\nz <- drop(array(list(1L, 'x', NULL), c(1, 3), list('r', c('a', 'b', 'c'))))\nplain <- structure(1:3, names = c('a', 'b', 'c'), note = 'keep')\nc(class(drop(custom)), attr(drop(custom), 'note'), is.null(dim(drop(custom))), class(drop(f)), levels(drop(f)), names(z), typeof(z), identical(drop(plain), plain), identical(drop(globalenv()), globalenv()))",
      ),
    ).resolves.toEqual([
      "probe",
      "keep",
      "TRUE",
      "factor",
      "a",
      "b",
      "a",
      "b",
      "c",
      "list",
      "TRUE",
      "TRUE",
    ]);
    await expect(runtime.eval("drop()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();
  });

  it("computes zoo's usage-ranked linear graphics ticks", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        explicit <- graphics::axTicks(
          si = "1",
          ax = c(0, 1, 3),
          usr = stop("linear usr stays lazy"),
          log = FALSE,
          nintLog = stop("linear nintLog stays lazy")
        )
        c(
          explicit,
          axTicks(2, axp = c(6, 0, -3.9), log = FALSE),
          axTicks(1, axp = c(0, 1, .74), log = FALSE),
          axTicks(1, axp = c(0, 1, .75), log = FALSE)
        )
      `),
    ).resolves.toEqual([0, 0.333333333333333, 0.666666666666667, 1, 6, 4.5, 3, 1.5, 0, 0, 0, 1]);

    await runtime.eval("plot.new()\nplot.window(c(1, 10), c(0, 130))");
    await expect(runtime.eval("c(axTicks(1), axTicks(4), graphics::axTicks(4))")).resolves.toEqual([
      2, 4, 6, 8, 10, 0, 20, 40, 60, 80, 100, 120, 0, 20, 40, 60, 80, 100, 120,
    ]);

    await runtime.eval("plot.window(c(10, 0), c(17, -3))");
    await expect(runtime.eval("c(axTicks(1), axTicks(2))")).resolves.toEqual([
      10, 8, 6, 4, 2, 0, 15, 10, 5, 0,
    ]);
    await expect(runtime.eval("axTicks(1, axp = c(0, 1, 0), log = FALSE)")).resolves.toBe(0);
    await expect(runtime.eval("axTicks(5, axp = c(0, 1, 5), log = FALSE)")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("axTicks(1, axp = c(0, 1), log = FALSE)")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("axTicks(1, axp = c(0, 1, 5), log = TRUE)")).rejects.toMatchObject({
      code: "NRU6159",
    });
    await runtime.dispose();

    const fresh = await session();
    await expect(fresh.eval("axTicks(1)")).rejects.toMatchObject({ code: "NRE2190" });
    await fresh.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 3 },
    });
    await expect(limited.eval("axTicks(1, axp = c(0, 1, 4), log = FALSE)")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("draws zoo's usage-ranked plot boxes through the graphics journal", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const styled = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 10), c(0, 5))
      visible <- withVisible(graphics::box(
        wh = "p",
        lty = "dashed",
        bty = "c",
        col = NA,
        fg = "red",
        lwd = 2,
        xpd = NA
      ))
      c(is.null(visible$value), visible$visible)
    `);
    expect(styled.value).toEqual([true, false]);
    expect(styled.visible).toBe(true);
    expect(styled.graphics).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 10], ylim: [0, 5] },
      {
        kind: "box",
        edges: ["top", "bottom", "left"],
        color: "#FF0000FF",
        lineType: "44",
        lineWidth: 2,
      },
    ]);
    expect(observed).toEqual(styled.graphics);

    const defaults = await runtime.evalDetailed(
      "box(which = c('plot', 'figure'), lty = NULL, lwd = NULL)",
    );
    expect(defaults.graphics).toEqual([
      {
        kind: "box",
        edges: ["top", "right", "bottom", "left"],
        color: "#000000FF",
        lineType: "solid",
        lineWidth: 1,
      },
    ]);
    await expect(runtime.eval("box(bty = 'n')")).resolves.toBeNull();
    await expect(runtime.eval("box(col = 'transparent')")).resolves.toBeNull();

    const warning = await runtime.evalDetailed("box(wat = 1)");
    expect(warning.warnings).toEqual([
      { code: "NRW1028", message: '"wat" is not a graphical parameter' },
    ]);
    expect(warning.graphics).toHaveLength(1);

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.at(-1)).toEqual(warning.graphics[0]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "box",
              edges = c("top", "top"),
              col = "#FF0000FF",
              lty = "solid",
              lwd = 1
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });

    await expect(runtime.eval("box(which = 'figure')")).rejects.toMatchObject({ code: "NRU6161" });
    await expect(runtime.eval("box(which = NA_character_)")).rejects.toMatchObject({
      code: "NRT3344",
    });
    await expect(runtime.eval("box(bty = 'x')")).rejects.toMatchObject({ code: "NRT3344" });
    await expect(runtime.eval("box(lty = c(1, 2))")).rejects.toMatchObject({ code: "NRT3344" });
    await expect(runtime.eval("box(lwd = 0)")).rejects.toMatchObject({ code: "NRT3344" });
    await runtime.reset();
    await expect(runtime.eval("box()")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 90 },
    });
    await expect(limited.eval("plot.new()\nbox(col = 'red')")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("computes and draws zoo's usage-ranked boxplots through S3 and Worker graphics seams", async () => {
    const runtime = await createR({
      execution: "inline",
      assets,
    });
    await expect(
      runtime.eval(`
        fit <- graphics::boxplot(c(1, 2, 3, 4, 5, 100, NA), plot = FALSE)
        c(fit$stats, fit$n, round(fit$conf, 12), fit$out, fit$group)
      `),
    ).resolves.toEqual([1, 2, 3.5, 5, 5, 6, 1.564903103201, 5.435096896799, 100, 1]);
    await expect(
      runtime.eval(`
        fit <- boxplot(list(a = 1:5, b = c(2, 4, 6, 8, 100)), plot = FALSE)
        c(dim(fit$stats), dim(fit$conf), fit$n, fit$stats, fit$out, fit$group, fit$names)
      `),
    ).resolves.toEqual([
      "5",
      "2",
      "2",
      "2",
      "5",
      "5",
      "1",
      "2",
      "3",
      "4",
      "5",
      "2",
      "4",
      "6",
      "8",
      "8",
      "100",
      "2",
      "a",
      "b",
    ]);
    await expect(
      runtime.eval(`
        empty <- boxplot(numeric(), plot = FALSE)
        c(empty$n, is.na(empty$stats), is.na(empty$conf), length(empty$out), empty$names)
      `),
    ).resolves.toEqual(["0", "TRUE", "TRUE", "TRUE", "TRUE", "TRUE", "TRUE", "TRUE", "0", "1"]);

    const matrixVisibility = await runtime.evalDetailed(`
      visible <- withVisible(boxplot(
        matrix(1:12, nrow = 4, dimnames = list(NULL, c("a", "b", "c"))),
        plot = FALSE
      ))
      visible$visible
    `);
    expect(matrixVisibility.value).toBe(false);

    await expect(
      runtime.eval(`
        boxplot.probe <- function(x, ..., marker = "ok") c(class(x), marker, list(...)$extra)
        boxplot(structure(1:3, class = "probe"), marker = "custom", extra = 7)
      `),
    ).resolves.toEqual(["probe", "custom", "7"]);

    const drawn = await runtime.evalDetailed(`
      boxplot(
        list(alpha = 1:5, beta = c(2, 4, 6, 8, 100)),
        border = c("black", "red"),
        col = c("lightgray", "blue")
      )
    `);
    expect(drawn.visible).toBe(false);
    expect(drawn.graphics.slice(0, 2)).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0.5, 2.5], ylim: [-2.96, 103.96] },
    ]);
    expect(drawn.graphics[2]).toEqual({
      kind: "boxplot",
      horizontal: false,
      notch: false,
      groups: [
        {
          label: "alpha",
          center: 1,
          width: 0.8,
          stats: [1, 2, 3, 4, 5],
          confidence: [1.5868050382201329, 4.413194961779867],
          outliers: [],
          border: "#000000FF",
          fill: "#D3D3D3FF",
          lineType: "solid",
          lineWidth: 1,
        },
        {
          label: "beta",
          center: 2,
          width: 0.8,
          stats: [2, 4, 6, 8, 8],
          confidence: [3.1736100764402657, 8.826389923559734],
          outliers: [100],
          border: "#FF0000FF",
          fill: "#0000FFFF",
          lineType: "solid",
          lineWidth: 1,
        },
      ],
    });

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.at(-1)).toEqual(drawn.graphics[2]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "boxplot",
              horizontal = FALSE,
              notch = FALSE,
              groups = list(list(
                label = "x",
                center = 1,
                width = 0.8,
                stats = 1:4,
                conf = c(1, 2),
                out = numeric(),
                border = "#000000FF",
                fill = "#D3D3D3FF",
                lty = "solid",
                lwd = 1
              ))
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });

    const controlled = await runtime.evalDetailed(`
      boxplot(
        list(a = 1:4, b = 1:9),
        horizontal = TRUE,
        notch = TRUE,
        outline = FALSE,
        varwidth = TRUE,
        at = c(2, 5),
        width = c(1, 2),
        boxwex = 0.6,
        border = c("red", "blue"),
        col = NULL,
        lty = c("dashed", "dotted"),
        lwd = c(2, 3)
      )
    `);
    expect(controlled.visible).toBe(false);
    expect(controlled.warnings).toEqual([
      {
        code: "NRW1029",
        message: "some notches went outside hinges ('box'): maybe set notch=FALSE",
      },
    ]);
    expect(controlled.graphics[2]).toMatchObject({
      kind: "boxplot",
      horizontal: true,
      notch: true,
      groups: [
        {
          label: "a",
          center: 2,
          width: 0.19999999999999998,
          outliers: [],
          border: "#FF0000FF",
          fill: "#FFFFFF00",
          lineType: "44",
          lineWidth: 2,
        },
        {
          label: "b",
          center: 5,
          width: 0.6,
          outliers: [],
          border: "#0000FFFF",
          fill: "#FFFFFF00",
          lineType: "13",
          lineWidth: 3,
        },
      ],
    });
    const added = await runtime.evalDetailed("boxplot(10:12, at = 4, add = TRUE, col = 'green')");
    expect(added.graphics).toHaveLength(1);
    expect(added.graphics[0]).toMatchObject({
      kind: "boxplot",
      groups: [{ center: 4, fill: "#00FF00FF" }],
    });

    await expect(runtime.eval("boxplot(1:3, range = -1, plot = FALSE)")).rejects.toMatchObject({
      code: "NRT3345",
    });
    await expect(runtime.eval("boxplot(factor(c('a', 'b')), plot = FALSE)")).rejects.toMatchObject({
      code: "NRT3345",
    });
    await expect(runtime.eval("boxplot(1:3, log = 'y')")).rejects.toMatchObject({
      code: "NRU6162",
    });
    await expect(runtime.eval("boxplot(1:3, outpch = 4)")).rejects.toMatchObject({
      code: "NRU6162",
    });
    await runtime.reset();
    await expect(runtime.eval("boxplot(1:3, add = TRUE)")).rejects.toMatchObject({
      code: "NRE2190",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 300 },
    });
    await expect(limited.eval("boxplot(list(1:5, 6:10))")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("projects zoo's usage-ranked perspective surface through the browser graphics journal", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const precise = await runtime.evalDetailed(`
      z <- structure(matrix(1:4, 2, 2), class = c("zoo", "matrix", "array"))
      fit <- withVisible(graphics::persp(1:2, 3:4, z))
      c(fit$value, dim(fit$value), fit$visible)
    `);
    const expected = [
      2, 0, 0, -3, 0, 0.517638090205042, 0.643950550859379, -3.42160969286609, 0, -1.93185165257814,
      0.172546030068347, 3.59806490128373, 0, 1.93185165257814, -0.172546030068347,
      -2.59806490128373, 4, 4, 0,
    ];
    expect(precise.value).toHaveLength(expected.length);
    for (const [index, value] of expected.entries()) {
      expect((precise.value as readonly number[])[index]).toBeCloseTo(value, 12);
    }
    expect(precise.graphics.slice(0, 2)).toEqual([
      { kind: "new-page" },
      expect.objectContaining({ kind: "window" }),
    ]);
    expect(precise.graphics[2]).toMatchObject({ kind: "segments" });
    if (precise.graphics[2]?.kind === "segments") {
      expect(precise.graphics[2].segments).toHaveLength(16);
      expect(precise.graphics[2].segments.every((segment) => segment.color === "#000000FF")).toBe(
        true,
      );
    }
    expect(observed).toEqual(precise.graphics);

    await runtime.eval("recorded <- recordPlot()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)");
    expect(replayed.graphics).toEqual(precise.graphics);

    const measured = await runtime.evalDetailed(`
      nC <- 10
      nO <- 100
      dataM <- matrix(seq_len(nC * nO), nrow = nO, ncol = nC)
      zz <- structure(dataM, class = c("zoo", "matrix", "array"))
      pmat <- persp(1:nO, 1:nC, zz)
      c(dim(pmat), typeof(pmat))
    `);
    expect(measured.value).toEqual(["4", "4", "double"]);
    expect(measured.graphics[2]).toMatchObject({ kind: "segments" });
    if (measured.graphics[2]?.kind === "segments") {
      expect(measured.graphics[2].segments).toHaveLength(1902);
    }

    const missingCell = await runtime.evalDetailed(
      "persp(1:2, 1:2, matrix(c(1, NA, 3, 4), 2, 2), box = FALSE)",
    );
    expect(missingCell.graphics[2]).toMatchObject({ kind: "segments" });
    if (missingCell.graphics[2]?.kind === "segments") {
      expect(missingCell.graphics[2].segments).toHaveLength(2);
    }

    await expect(
      runtime.eval(`
        persp.probe <- function(x, ..., marker = "default") {
          c(class(x), marker, list(...)$extra)
        }
        custom <- withVisible(
          persp(structure(1:3, class = "probe"), marker = "custom", extra = 7)
        )
        c(custom$value, custom$visible)
      `),
    ).resolves.toEqual(["probe", "custom", "7", "TRUE"]);
    await expect(runtime.eval("persp(2:1, 1:2, matrix(1:4, 2, 2))")).rejects.toMatchObject({
      code: "NRT3346",
    });
    await expect(runtime.eval("persp(1:3, 1:2, matrix(1:4, 2, 2))")).rejects.toMatchObject({
      code: "NRT3346",
    });
    await expect(runtime.eval("persp(1:2, 1:2, matrix(1, 2, 2))")).rejects.toMatchObject({
      code: "NRT3346",
    });
    await expect(
      runtime.eval("persp(1:2, 1:2, matrix(1:4, 2, 2), col = 'red')"),
    ).rejects.toMatchObject({ code: "NRU6163" });
    await expect(
      runtime.eval("persp(1:2, 1:2, matrix(1:4, 2, 2), shade = 0.5)"),
    ).rejects.toMatchObject({ code: "NRU6163" });
    await expect(
      runtime.eval("persp(1:2, 1:2, matrix(1:4, 2, 2), ticktype = 'detailed')"),
    ).rejects.toMatchObject({ code: "NRU6163" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 10 },
    });
    await expect(limited.eval("persp(1:2, 1:2, matrix(1:4, 2, 2))")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("draws zoo's usage-ranked point generic through the Worker graphics protocol", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const drawn = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 5), c(0, 7))
      visible <- withVisible(graphics::points(
        1:5,
        2:6,
        pch = c(1, 19, 21, NA, 26),
        col = c("red", "blue", "green", "black", "black"),
        bg = c("transparent", "transparent", "yellow"),
        cex = c(1, 2, 1),
        lwd = c(1, 2)
      ))
      c(is.null(visible$value), visible$visible)
    `);
    expect(drawn.value).toEqual([true, false]);
    expect(drawn.graphics).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 5], ylim: [0, 7] },
      {
        kind: "points",
        points: [
          {
            x: 1,
            y: 2,
            symbol: 1,
            color: "#FF0000FF",
            fill: "#FFFFFF00",
            size: 1,
            lineWidth: 1,
          },
          {
            x: 2,
            y: 3,
            symbol: 19,
            color: "#0000FFFF",
            fill: "#FFFFFF00",
            size: 2,
            lineWidth: 2,
          },
          {
            x: 3,
            y: 4,
            symbol: 21,
            color: "#00FF00FF",
            fill: "#FFFF00FF",
            size: 1,
            lineWidth: 1,
          },
        ],
      },
    ]);
    expect(observed).toEqual(drawn.graphics);

    const character = await runtime.evalDetailed(
      "points(list(x = c(1, NA), y = c(6, 5)), pch = c('A', 'B'), col = 'purple')",
    );
    expect(character.graphics).toEqual([
      {
        kind: "points",
        points: [
          {
            x: 1,
            y: 6,
            symbol: "A",
            color: "#A020F0FF",
            fill: "#FFFFFF00",
            size: 1,
            lineWidth: 1,
          },
        ],
      },
    ]);
    const filled = await runtime.evalDetailed(
      "points(4, 5, pch = 21, col = 'transparent', bg = 'magenta')",
    );
    expect(filled.graphics).toEqual([
      {
        kind: "points",
        points: [
          {
            x: 4,
            y: 5,
            symbol: 21,
            color: "#FFFFFF00",
            fill: "#FF00FFFF",
            size: 1,
            lineWidth: 1,
          },
        ],
      },
    ]);
    const matrix = await runtime.evalDetailed("points(matrix(1:6, ncol = 2))");
    expect(matrix.graphics[0]).toMatchObject({ kind: "points" });
    if (matrix.graphics[0]?.kind === "points") {
      expect(matrix.graphics[0].points).toHaveLength(3);
    }
    await expect(runtime.evalDetailed("points(1:3, 4:6, type = 'n')")).resolves.toMatchObject({
      value: null,
      visible: false,
      graphics: [],
    });
    await expect(runtime.eval("points(numeric(), numeric())")).resolves.toBeNull();

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.filter((event) => event.kind === "points")).toHaveLength(4);
    expect(replayed.graphics.at(-1)).toEqual(matrix.graphics[0]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "points",
              points = list(list(
                x = 1,
                y = 2,
                pch = 99,
                col = "#000000FF",
                bg = "#FFFFFF00",
                cex = 1,
                lwd = 1
              ))
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });

    await expect(
      runtime.eval(`
        points.probe <- function(x, y = NULL, type = "p", ..., marker = "default") {
          c(class(x), marker, list(...)$extra)
        }
        custom <- withVisible(
          points(structure(1:3, class = "probe"), marker = "custom", extra = 7)
        )
        c(custom$value, custom$visible)
      `),
    ).resolves.toEqual(["probe", "custom", "7", "TRUE"]);
    await expect(runtime.eval("points(1:3, 4:5)")).rejects.toMatchObject({ code: "NRT3347" });
    await expect(runtime.eval("points(1:3, 4:6, type = 'l')")).rejects.toMatchObject({
      code: "NRU6164",
    });
    await expect(runtime.eval("points(1:3, 4:6, pch = 'AB')")).rejects.toMatchObject({
      code: "NRU6164",
    });
    await runtime.reset();
    await expect(runtime.eval("points(1, 2)")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 10 },
    });
    await expect(limited.eval("plot.new()\npoints(1:2, 2:3)")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("draws zoo's usage-ranked plot labels through the Worker graphics protocol", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const drawn = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 10), c(0, 10))
      visible <- withVisible(graphics::text(
        1:3,
        c(4, 5),
        c("alpha", "beta", "gamma", "cut"),
        adj = c(0, 1),
        pos = c(1, 4),
        offset = 0.25,
        cex = c(2, 1),
        col = c("blue", "green"),
        font = c(2, 4),
        srt = -90,
        family = "serif",
        xpd = TRUE
      ))
      c(is.null(visible$value), visible$visible)
    `);
    expect(drawn.value).toEqual([true, false]);
    expect(drawn.warnings).toEqual([
      {
        code: "NRW1110",
        message: "length(labels) > max(length(x), length(y)); 'labels' truncated to length 3",
      },
    ]);
    expect(drawn.graphics).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 10], ylim: [0, 10] },
      {
        kind: "text",
        labels: [
          {
            x: 1,
            y: 4,
            label: "alpha",
            color: "#0000FFFF",
            size: 2,
            font: 2,
            family: "serif",
            rotation: -90,
            horizontalAdjustment: 0,
            verticalAdjustment: 1,
            position: 1,
            offset: 0.25,
          },
          {
            x: 2,
            y: 5,
            label: "beta",
            color: "#00FF00FF",
            size: 1,
            font: 4,
            family: "serif",
            rotation: -90,
            horizontalAdjustment: 0,
            verticalAdjustment: 1,
            position: 4,
            offset: 0.25,
          },
          {
            x: 3,
            y: 4,
            label: "gamma",
            color: "#0000FFFF",
            size: 2,
            font: 2,
            family: "serif",
            rotation: -90,
            horizontalAdjustment: 0,
            verticalAdjustment: 1,
            position: 1,
            offset: 0.25,
          },
        ],
      },
    ]);
    expect(observed).toEqual(drawn.graphics);

    const omitted = await runtime.evalDetailed(
      "text(c(7, NA), 5, c('kept', 'omitted'), col = c('purple', 'red'))",
    );
    expect(omitted.graphics).toEqual([
      {
        kind: "text",
        labels: [
          {
            x: 7,
            y: 5,
            label: "kept",
            color: "#A020F0FF",
            size: 1,
            font: 1,
            family: "",
            rotation: 0,
            horizontalAdjustment: 0.5,
            verticalAdjustment: 0.5,
            offset: 0.5,
          },
        ],
      },
    ]);
    const defaults = await runtime.evalDetailed("text(list(x = 8:9, y = c(6, 7)))");
    expect(defaults.graphics[0]).toMatchObject({
      kind: "text",
      labels: [{ label: "1" }, { label: "2" }],
    });

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.filter((event) => event.kind === "text")).toHaveLength(3);
    expect(replayed.graphics.at(-1)).toEqual(defaults.graphics[0]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "text",
              labels = list(list(
                x = 1, y = 2, label = "x", col = "#000000FF", cex = 1,
                font = 9, family = "", srt = 0, hadj = 0.5, vadj = 0.5,
                pos = NULL, offset = 0.5
              ))
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });
    await expect(
      runtime.eval(`
        text.probe <- function(x, y = NULL, labels = "default", ..., marker = "default") {
          c(class(x), labels, marker, list(...)$extra)
        }
        text(structure(1:2, class = "probe"), labels = "custom", marker = "yes", extra = 7)
      `),
    ).resolves.toEqual(["probe", "custom", "yes", "7"]);
    await expect(runtime.eval("text(1, 2, character())")).rejects.toMatchObject({
      code: "NRT3349",
    });
    await expect(runtime.eval("text(1, 2, expression(alpha))")).rejects.toMatchObject({
      code: "NRU6165",
    });
    await expect(runtime.eval("text(1, 2, 'x', font = 5)")).rejects.toMatchObject({
      code: "NRU6165",
    });
    await runtime.reset();
    await expect(runtime.eval("text(1, 2, 'x')")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 10 },
    });
    await expect(limited.eval("plot.new()\ntext(1:2, 2:3, c('a', 'b'))")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("fills zoo's usage-ranked area polygon through the Worker graphics protocol", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const measured = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 5), c(0, 5))
      x <- 1:3
      y <- c(1, 3, 2)
      visible <- withVisible(graphics::polygon(
        c(x[1], x, tail(x, 1), x[1]),
        c(0, as.numeric(y), 0, 0),
        col = 2
      ))
      c(is.null(visible$value), visible$visible)
    `);
    expect(measured.value).toEqual([true, false]);
    expect(measured.graphics).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 5], ylim: [0, 5] },
      {
        kind: "polygon",
        polygons: [
          {
            x: [1, 1, 2, 3, 3, 1],
            y: [0, 1, 3, 2, 0, 0],
            fill: "#DF536BFF",
            border: "#000000FF",
            lineType: "solid",
            lineWidth: 1,
            fillRule: "nonzero",
          },
        ],
      },
    ]);
    expect(observed).toEqual(measured.graphics);

    const split = await runtime.evalDetailed(`
      polygon(
        c(1, 2, 2, 1, NA, 3, 4, 4, 3),
        c(1, 1, 2, 2, NA, 3, 3, 4, 4),
        col = c("red", "blue"),
        border = c(FALSE, TRUE),
        lty = c("dashed", "dotted"),
        lwd = c(2, 3),
        fillOddEven = TRUE
      )
    `);
    expect(split.graphics).toEqual([
      {
        kind: "polygon",
        polygons: [
          {
            x: [1, 2, 2, 1],
            y: [1, 1, 2, 2],
            fill: "#FF0000FF",
            border: "#FFFFFF00",
            lineType: "44",
            lineWidth: 2,
            fillRule: "evenodd",
          },
          {
            x: [3, 4, 4, 3],
            y: [3, 3, 4, 4],
            fill: "#0000FFFF",
            border: "#000000FF",
            lineType: "13",
            lineWidth: 3,
            fillRule: "evenodd",
          },
        ],
      },
    ]);

    const noFill = await runtime.evalDetailed(
      "polygon(matrix(c(1, 2, 2, 1, 1, 1, 2, 2), ncol = 2), density = 0, col = 'yellow', border = 'blue')",
    );
    expect(noFill.graphics[0]).toMatchObject({
      kind: "polygon",
      polygons: [
        {
          fill: "#FFFFFF00",
          border: "#0000FFFF",
        },
      ],
    });
    await expect(
      runtime.evalDetailed("polygon(list(x = numeric(), y = numeric()))"),
    ).resolves.toMatchObject({ value: null, visible: false, graphics: [] });

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.filter((event) => event.kind === "polygon")).toHaveLength(3);
    expect(replayed.graphics.at(-1)).toEqual(noFill.graphics[0]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "polygon",
              polygons = list(list(
                x = c(1, 2),
                y = 1,
                col = "#FF0000FF",
                border = "#000000FF",
                lty = "solid",
                lwd = 1,
                rule = "nonzero"
              ))
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });
    await expect(runtime.eval("polygon(1:3, 1:2)")).rejects.toMatchObject({ code: "NRT3348" });
    await expect(runtime.eval("polygon(1:3, 1:3, density = 10)")).rejects.toMatchObject({
      code: "NRU6165",
    });
    await expect(runtime.eval("polygon(1:3, 1:3, xpd = TRUE)")).rejects.toMatchObject({
      code: "NRU6165",
    });
    await runtime.reset();
    await expect(runtime.eval("polygon(1:3, 1:3)")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 10 },
    });
    await expect(limited.eval("plot.new()\npolygon(1:3, c(1, 3, 1))")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await limited.dispose();
  });

  it("emits browser-native raster graphics for usage-ranked package patterns", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const result = await runtime.evalDetailed(
      "image <- array(c(1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, .5, .25, 0), c(2, 2, 4))\nplot.new()\nplot.window(c(0, 4), c(0, 2), asp = 1)\nrasterImage(image, c(0, 2), 0, c(2, 4), 2, angle = c(0, 15), interpolate = c(FALSE, TRUE))",
    );
    expect(result.value).toBeNull();
    expect(result.visible).toBe(false);
    expect(result.graphics).toHaveLength(4);
    expect(result.graphics.slice(0, 2)).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 4], ylim: [0, 2] },
    ]);
    expect(result.graphics[2]).toMatchObject({
      kind: "raster",
      width: 2,
      height: 2,
      xleft: 0,
      ybottom: 0,
      xright: 2,
      ytop: 2,
      angle: 0,
      interpolate: false,
    });
    expect(result.graphics[3]).toMatchObject({
      kind: "raster",
      xleft: 2,
      xright: 4,
      angle: 15,
      interpolate: true,
    });
    const firstRaster = result.graphics[2];
    expect(firstRaster?.kind).toBe("raster");
    if (firstRaster?.kind === "raster") {
      expect([...firstRaster.rgba]).toEqual([
        255, 0, 0, 255, 0, 0, 255, 64, 0, 255, 0, 128, 255, 255, 255, 0,
      ]);
    }
    expect(observed).toEqual(result.graphics);

    const native = await runtime.evalDetailed(
      "plot.new()\nplot.window(c(0, 2), c(0, 1))\nx <- structure(c(-16776961L, -16711936L), dim = c(1, 2), class = 'nativeRaster')\ngraphics::rasterImage(x, 0, 0, 2, 1)",
    );
    const nativeRaster = native.graphics[2];
    expect(nativeRaster?.kind).toBe("raster");
    if (nativeRaster?.kind === "raster") {
      expect([...nativeRaster.rgba]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
    }
    await runtime.reset();
    await expect(runtime.eval("rasterImage(matrix(0, 1, 1), 0, 0, 1, 1)")).rejects.toMatchObject({
      code: "NRE2190",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 15 },
    });
    await expect(
      limited.eval(
        "plot.new()\nplot.window(c(0, 1), c(0, 1))\nrasterImage(matrix(0, 2, 2), 0, 0, 1, 1)",
      ),
    ).rejects.toMatchObject({ code: "NRL4007" });
    await limited.dispose();

    const commandLimited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 3 },
    });
    await commandLimited.eval("plot.new()\ndev.hold()");
    await commandLimited.eval("plot.window(c(0, 1), c(0, 1))");
    await commandLimited.eval("plot.window(c(0, 1), c(0, 1))");
    await expect(commandLimited.eval("plot.window(c(0, 1), c(0, 1))")).rejects.toMatchObject({
      code: "NRL4002",
    });
    await commandLimited.dispose();
  });

  it("draws posterior's usage-ranked interval segments through the graphics journal", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const result = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 5), c(0, 10))
      graphics::segments(
        1:4,
        c(2, 4, 6, 8),
        y1 = c(3, 5, 7, 9),
        col = c("red", "blue", NA, "#00FF0080"),
        lty = 1:4,
        lwd = c(1, 2, NA, 0)
      )
    `);
    expect(result.value).toBeNull();
    expect(result.visible).toBe(false);
    expect(result.graphics).toHaveLength(3);
    expect(result.graphics.slice(0, 2)).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 5], ylim: [0, 10] },
    ]);
    expect(result.graphics[2]).toEqual({
      kind: "segments",
      segments: [
        {
          x0: 1,
          y0: 2,
          x1: 1,
          y1: 3,
          color: "#FF0000FF",
          lineType: "solid",
          lineWidth: 1,
        },
        {
          x0: 2,
          y0: 4,
          x1: 2,
          y1: 5,
          color: "#0000FFFF",
          lineType: "44",
          lineWidth: 2,
        },
        {
          x0: 4,
          y0: 8,
          x1: 4,
          y1: 9,
          color: "#00FF0080",
          lineType: "1343",
          lineWidth: 0.01,
        },
      ],
    });
    expect(observed).toEqual(result.graphics);

    const recycled = await runtime.evalDetailed(`
      segments(c(1, NA, 3), 1:2, x1 = c(4, 5), y1 = 6, col = c(1, 2, 0), lty = 7)
    `);
    expect(recycled.graphics).toEqual([
      {
        kind: "segments",
        segments: [
          {
            x0: 1,
            y0: 1,
            x1: 4,
            y1: 6,
            color: "#000000FF",
            lineType: "solid",
            lineWidth: 1,
          },
          {
            x0: 3,
            y0: 1,
            x1: 4,
            y1: 6,
            color: "#FFFFFFFF",
            lineType: "solid",
            lineWidth: 1,
          },
        ],
      },
    ]);
    await expect(
      runtime.eval("segments(numeric(), numeric(), numeric(), numeric())"),
    ).resolves.toBeNull();
    await expect(runtime.eval("segments(1, 2)")).rejects.toMatchObject({ code: "NRE2192" });
    await expect(runtime.eval("segments(numeric(), 1, numeric(), 2)")).rejects.toMatchObject({
      code: "NRT3334",
    });
    await expect(runtime.eval("segments(1, 1, 2, 2, col = 'not-a-colour')")).rejects.toMatchObject({
      code: "NRT3297",
    });
    await expect(runtime.eval("segments(1, 1, 2, 2, lty = 'wat')")).rejects.toMatchObject({
      code: "NRT3334",
    });
    await expect(runtime.eval("segments(1, 1, 2, 2, lwd = Inf)")).rejects.toMatchObject({
      code: "NRT3334",
    });

    await runtime.eval(`
      recorded <- recordPlot()
      dev.hold()
    `);
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.at(-1)).toEqual(recycled.graphics[0]);
    await expect(
      runtime.eval(`
        replayPlot(structure(
          list(
            list(list(
              kind = "segments",
              x0 = 1,
              y0 = 1,
              x1 = 2,
              y1 = 2,
              col = "#GG0000FF",
              lty = "solid",
              lwd = 1
            )),
            NULL
          ),
          class = "recordedplot"
        ))
      `),
    ).rejects.toMatchObject({ code: "NRT3333" });
    await runtime.reset();
    await expect(runtime.eval("segments(1, 1, 2, 2)")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 100 },
    });
    await expect(limited.eval("plot.new()\nsegments(1:2, 1:2, 2:3, 3:4)")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("draws zoo's usage-ranked legends through the graphics journal", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });
    const result = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 10), c(0, 10))
      visible <- withVisible(graphics::legend(
        "bottomleft",
        legend = c("alpha", "beta"),
        lty = 1,
        pch = 1:2,
        col = 1:2,
        text.col = c("blue", "red"),
        inset = 0.05,
        title = "Groups"
      ))
      c(
        names(visible$value),
        names(visible$value$rect),
        names(visible$value$text),
        visible$visible
      )
    `);
    expect(result.value).toEqual(["rect", "text", "w", "h", "left", "top", "x", "y", "FALSE"]);
    expect(result.visible).toBe(true);
    expect(result.graphics).toHaveLength(3);
    expect(result.graphics[2]).toEqual({
      kind: "legend",
      position: { kind: "keyword", value: "bottomleft", inset: [0.05, 0.05] },
      entries: [
        {
          label: "alpha",
          textColor: "#0000FFFF",
          color: "#000000FF",
          lineType: "solid",
          lineWidth: 1,
          pointSymbol: "1",
        },
        {
          label: "beta",
          textColor: "#FF0000FF",
          color: "#DF536BFF",
          lineType: "solid",
          lineWidth: 1,
          pointSymbol: "2",
        },
      ],
      box: true,
      background: "#FFFFFFFF",
      columns: 1,
      cex: 1,
      title: "Groups",
    });
    expect(observed).toEqual(result.graphics);

    const zooShapes = await runtime.evalDetailed(`
      sites <- c("site 1", "site 2", "site 3")
      first <- withVisible(legend(
        "bottomleft",
        legend = sites,
        lty = 1,
        pch = 1:3,
        col = 1:3
      ))
      second <- withVisible(legend("bottomright", sites, lty = 1, col = 1:2))
      third <- withVisible(legend(
        x = "topleft",
        bty = "n",
        lty = c(1, 1),
        col = c("black", "blue"),
        legend = paste(sites[1:2], c("(left scale)", "(right scale)"))
      ))
      coordinate <- withVisible(legend(
        8,
        9,
        c("x", "y"),
        pch = c("x", "y"),
        horiz = TRUE,
        plot = FALSE
      ))
      c(
        first$visible,
        second$visible,
        third$visible,
        coordinate$visible,
        names(coordinate$value)
      )
    `);
    expect(zooShapes.value).toEqual(["FALSE", "FALSE", "FALSE", "FALSE", "rect", "text"]);
    expect(zooShapes.graphics).toHaveLength(3);
    expect(zooShapes.graphics[1]).toMatchObject({
      kind: "legend",
      position: { kind: "keyword", value: "bottomright" },
      columns: 1,
    });
    expect(zooShapes.graphics[2]).toMatchObject({
      kind: "legend",
      position: { kind: "keyword", value: "topleft" },
      box: false,
    });

    await runtime.eval("recorded <- recordPlot()\ndev.hold()");
    const replayed = await runtime.evalDetailed("replayPlot(recorded)\ndev.flush()");
    expect(replayed.graphics.filter((event) => event.kind === "legend")).toHaveLength(4);
    expect(replayed.graphics.at(-1)).toEqual(zooShapes.graphics.at(-1));

    await expect(runtime.eval("legend('middle', 'x')")).rejects.toMatchObject({
      code: "NRT3334",
    });
    await expect(runtime.eval("legend(1, legend = 'x')")).rejects.toMatchObject({
      code: "NRE2193",
    });
    await expect(runtime.eval("legend('top', 'x', fill = 'red')")).rejects.toMatchObject({
      code: "NRU6159",
    });
    await runtime.reset();
    await expect(runtime.eval("legend('top', 'x')")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 100 },
    });
    await expect(
      limited.eval("plot.new()\nlegend('top', c('alpha', 'beta'), pch = 1:2)"),
    ).rejects.toMatchObject({ code: "NRL4007" });
    await limited.dispose();
  });

  it("buffers usage-ranked graphics across evaluations with dev.hold and dev.flush", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });

    await expect(runtime.eval("dev.flush()")).resolves.toBe(0);
    const opened = await runtime.evalDetailed("plot.new()\ndev.hold()");
    expect(opened.value).toBe(1);
    expect(opened.visible).toBe(true);
    expect(opened.graphics).toEqual([{ kind: "new-page" }]);

    const held = await runtime.evalDetailed(`
      plot.window(c(0, 1), c(0, 1))
      rasterImage(matrix(c("red", "blue"), 1, 2), 0, 0, 1, 1)
      dev.hold(2)
    `);
    expect(held.value).toBe(3);
    expect(held.graphics).toEqual([]);
    expect(observed).toEqual([{ kind: "new-page" }]);

    const nested = await runtime.evalDetailed("grDevices::dev.flush()");
    expect(nested.value).toBe(2);
    expect(nested.graphics).toEqual([]);

    const flushed = await runtime.evalDetailed("grDevices::dev.flush(2)");
    expect(flushed.value).toBe(0);
    expect(flushed.visible).toBe(true);
    expect(flushed.graphics).toHaveLength(2);
    expect(flushed.graphics[0]).toEqual({
      kind: "window",
      xlim: [0, 1],
      ylim: [0, 1],
    });
    expect(flushed.graphics[1]).toMatchObject({
      kind: "raster",
      width: 2,
      height: 1,
      xleft: 0,
      ybottom: 0,
      xright: 1,
      ytop: 1,
    });
    expect(observed).toEqual([{ kind: "new-page" }, ...flushed.graphics]);

    await expect(
      runtime.eval(`
        a <- dev.hold(2.9)
        b <- dev.hold(c(-2, 4))
        invalid <- dev.hold(NA)
        current <- dev.hold(0)
        c(a, b, invalid, current, dev.flush(TRUE), dev.flush(20))
      `),
    ).resolves.toEqual([2, 6, 0, 6, 5, 0]);
    await expect(runtime.eval("dev.flush('2')")).rejects.toMatchObject({ code: "NRT3332" });

    await runtime.eval("dev.hold()\nplot.window(c(0, 2), c(0, 2))");
    await runtime.reset();
    const afterReset = await runtime.evalDetailed("dev.flush()");
    expect(afterReset.value).toBe(0);
    expect(afterReset.graphics).toEqual([]);
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 7 },
    });
    await expect(
      limited.eval(
        "plot.new()\ndev.hold()\nplot.window(c(0, 1), c(0, 1))\nrasterImage(matrix('red', 1, 2), 0, 0, 1, 1)",
      ),
    ).rejects.toMatchObject({ code: "NRL4007" });
    await limited.dispose();
  });

  it("records and replays the usage-ranked ragg display-list call shape", async () => {
    const observed: unknown[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onGraphics: (event) => observed.push(event),
    });

    await expect(
      runtime.eval(`
        plot.new()
        plot.window(c(0, 2), c(0, 1))
        rasterImage(matrix(c("red", "blue"), 1, 2), 0, 0, 2, 1, interpolate = FALSE)
        recorded <- recordPlot(load = "stats", attach = "utils")
        c(
          typeof(recorded),
          mode(recorded),
          class(recorded),
          length(recorded),
          is.null(names(recorded)),
          attr(recorded, "load"),
          attr(recorded, "attach")
        )
      `),
    ).resolves.toEqual(["list", "list", "recordedplot", "2", "TRUE", "stats", "utils"]);
    expect(observed).toHaveLength(3);
    const recordedEvents = observed.slice();

    const replayed = await runtime.evalDetailed("grDevices::replayPlot(recorded)");
    expect(replayed.value).toBeNull();
    expect(replayed.visible).toBe(false);
    expect(replayed.graphics).toHaveLength(3);
    expect(replayed.graphics.slice(0, 2)).toEqual([
      { kind: "new-page" },
      { kind: "window", xlim: [0, 2], ylim: [0, 1] },
    ]);
    const replayedRaster = replayed.graphics[2];
    expect(replayedRaster?.kind).toBe("raster");
    if (replayedRaster?.kind === "raster") {
      expect([...replayedRaster.rgba]).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
    }
    expect(observed).toEqual([...recordedEvents, ...replayed.graphics]);

    await runtime.eval("dev.hold()");
    const heldReplay = await runtime.evalDetailed("replayPlot(recorded)");
    expect(heldReplay.graphics).toEqual([]);
    const releasedReplay = await runtime.evalDetailed("dev.flush()");
    expect(releasedReplay.graphics).toEqual(replayed.graphics);

    await expect(runtime.eval("replayPlot(recorded, reloadPkgs = TRUE)")).rejects.toMatchObject({
      code: "NRU6150",
    });
    await expect(runtime.eval("replayPlot(list())")).rejects.toMatchObject({ code: "NRT3333" });
    await expect(
      runtime.eval(
        "replayPlot(structure(list(list(list(kind = 'unknown')), NULL), class = 'recordedplot'))",
      ),
    ).rejects.toMatchObject({ code: "NRT3333" });
    await runtime.reset();
    await expect(runtime.eval("recordPlot()")).rejects.toMatchObject({ code: "NRE2190" });
    await runtime.dispose();
  });

  it("generates posterior's usage-ranked probability points", async () => {
    const runtime = await session();
    const observed = await runtime.eval(
      "p <- stats::ppoints(10)\nq <- quantile(1:100, p)\nc(p, length(q), q[[1]], q[[10]])",
    );
    expect(observed).toEqual([
      0.06097560975609756, 0.15853658536585366, 0.25609756097560976, 0.35365853658536583,
      0.45121951219512196, 0.5487804878048781, 0.6463414634146342, 0.7439024390243902,
      0.8414634146341463, 0.9390243902439024, 10, 7.036585365853659, 93.96341463414633,
    ]);
    await expect(
      runtime.eval(
        "c(ppoints(4), ppoints(c(100, 200)), ppoints(list(10, 20, 30)), ppoints(2.9), ppoints(.5))",
      ),
    ).resolves.toEqual([
      0.14705882352941177, 0.38235294117647056, 0.6176470588235294, 0.8529411764705882,
      0.2777777777777778, 0.7222222222222222, 0.19230769230769232, 0.5, 0.8076923076923077,
      0.19841269841269843, 0.5158730158730159, 0.8333333333333334,
    ]);
    await expect(
      runtime.eval("x <- ppoints(4, a = matrix(c(.1, .2, .3, .4), 2, 2)); c(x, dim(x))"),
    ).resolves.toEqual([0.1875, 0.391304347826087, 0.6136363636363636, 0.8571428571428571, 2, 2]);
    await expect(runtime.eval("ppoints(0, a = stop('must stay lazy'))")).resolves.toEqual([]);
    const recycled = await runtime.evalDetailed("ppoints(4, a = c(.1, .2, .3))");
    expect(recycled.value).toEqual([0.1875, 0.391304347826087, 0.6136363636363636, 0.8125]);
    expect(recycled.warnings).toHaveLength(2);
    expect(recycled.warnings.every((warning) => warning.code === "NRW1001")).toBe(true);
    await expect(runtime.eval("ppoints(NULL)")).rejects.toMatchObject({ code: "NRT3334" });
    await expect(runtime.eval("ppoints(NA)")).rejects.toMatchObject({ code: "NRT3334" });
    await expect(runtime.eval("ppoints(Inf)")).rejects.toMatchObject({ code: "NRL4002" });
    await expect(runtime.eval("ppoints(4, a = '0.5')")).rejects.toMatchObject({
      code: "NRT3334",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 3 },
    });
    await expect(limited.eval("ppoints(4)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("provides posterior's usage-ranked Cholesky dispatch and owned matrix factor", async () => {
    const runtime = await session();
    await runtime.eval("chol.rvar <- function(x, ..., marker = 7) c(class(x), marker)\nNULL");
    await expect(runtime.eval("chol(structure(1, class = 'rvar'), marker = 9)")).resolves.toEqual([
      "rvar",
      "9",
    ]);

    await expect(
      runtime.eval(
        "x <- matrix(c(5, 1, 1, 3), 2, 2, dimnames = list(c('r1', 'r2'), c('a', 'b')))\nr <- base::chol.default(x)\nc(r, dim(r), identical(dimnames(r), list(c('r1', 'r2'), c('a', 'b'))))",
      ),
    ).resolves.toEqual([2.23606797749979, 0, 0.4472135954999579, 1.6733200530681511, 2, 2, 1]);
    await expect(runtime.eval("chol(matrix(c(4, 999, 2, 3), 2, 2))")).resolves.toEqual([
      2, 0, 1, 1.4142135623730951,
    ]);
    await expect(
      runtime.eval(
        "data <- data.frame(a = c(2, 0), b = c(0, 3))\nr <- chol(data)\nc(r, dim(r), identical(dimnames(r), list(NULL, c('a', 'b'))))",
      ),
    ).resolves.toEqual([1.4142135623730951, 0, 0, 1.7320508075688772, 2, 2, 1]);
    await expect(
      runtime.eval(
        "r <- chol(diag(c(1, 4, 9)), pivot = TRUE)\nc(r, attr(r, 'pivot'), attr(r, 'rank'))",
      ),
    ).resolves.toEqual([3, 0, 0, 0, 2, 0, 0, 0, 1, 3, 2, 1, 3]);

    const rankDeficient = await runtime.evalDetailed(
      "r <- chol(matrix(c(1, 1, 1, 1), 2, 2), pivot = TRUE)\nc(r, attr(r, 'pivot'), attr(r, 'rank'))",
    );
    expect(rankDeficient.value).toEqual([1, 0, 1, 0, 1, 2, 1]);
    expect(rankDeficient.warnings).toHaveLength(1);
    await expect(
      runtime.eval("chol(diag(2), unused = stop('dots must stay lazy'))"),
    ).resolves.toEqual([1, 0, 0, 1]);
    await expect(runtime.eval("chol(diag(2), tol = stop('tol must be forced'))")).rejects.toThrow(
      "tol must be forced",
    );
    await expect(runtime.eval("chol(diag(2), LINPACK = FALSE)")).rejects.toMatchObject({
      code: "NRE2191",
    });
    await expect(runtime.eval("chol(matrix(c(1, 1, 1, 1), 2, 2))")).rejects.toMatchObject({
      code: "NRE2192",
    });
    await expect(runtime.eval("chol(matrix(1:6, 2, 3))")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("chol(matrix(c(1, NA, NA, 1), 2, 2))")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("chol(matrix(c(2 + 0i, 0, 0, 2), 2, 2))")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await runtime.dispose();
  });

  it("converts the usage-ranked ragg capture matrix through as.raster", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        captured <- matrix(c("red", "#00FF0080", "transparent", NA_character_), 2, 2)
        raster <- as.raster(captured)
        c(raster, dim(raster), class(raster), is.null(dimnames(raster)), is.null(names(raster)))
      `),
    ).resolves.toEqual(["red", "transparent", "#00FF0080", NA, "2", "2", "raster", "TRUE", "TRUE"]);
    await expect(runtime.eval("as.raster(1:5, max = 5)")).resolves.toEqual([
      "#333333",
      "#666666",
      "#999999",
      "#CCCCCC",
      "#FFFFFF",
    ]);
    await expect(runtime.eval("as.raster(c(TRUE, FALSE, NA))")).resolves.toEqual([
      "#FFFFFF",
      "#000000",
      NA,
    ]);
    await expect(runtime.eval("as.raster(as.raw(c(0, 127, 255)))")).resolves.toEqual([
      "#000000",
      "#7F7F7F",
      "#FFFFFF",
    ]);
    await expect(runtime.eval("as.raster(matrix(c(0, .25, .5, 1), 2, 2))")).resolves.toEqual([
      "#000000",
      "#808080",
      "#404040",
      "#FFFFFF",
    ]);
    await expect(
      runtime.eval("as.raster(array(c(1, 0, 0, 1, 0, 0), c(2, 1, 3)))"),
    ).resolves.toEqual(["#FF0000", "#00FF00"]);
    await expect(
      runtime.eval("as.raster(array(c(1, 0, 0, 1, 0, 0, 1, .5), c(2, 1, 4)))"),
    ).resolves.toEqual(["#FF0000FF", "#00FF0080"]);
    await expect(
      runtime.eval("x <- as.raster(1:4, max = 4, ncol = 2); c(x, dim(x))"),
    ).resolves.toEqual(["#404040", "#BFBFBF", "#808080", "#FFFFFF", "2", "2"]);
    await expect(runtime.eval('as.raster("red", max = stop("not forced"))')).resolves.toBe("red");
    await expect(
      runtime.eval('grDevices:::as.raster.numeric(c(0, 1), max = "1")'),
    ).resolves.toEqual(["#000000", "#FFFFFF"]);
    await expect(
      runtime.eval(`
        as.raster.tile <- function(x, ...) {
          structure("#010203", dim = c(1, 1), class = "raster")
        }
        custom <- as.raster(structure(1, class = "tile"))
        c(custom, is.raster(custom), identical(as.raster(custom), custom))
      `),
    ).resolves.toEqual(["#010203", "TRUE", "TRUE"]);
    await expect(
      runtime.eval("c(is.raster(structure('red', class = 'raster')), is.raster(matrix('red')))"),
    ).resolves.toEqual([true, false]);

    const rendered = await runtime.evalDetailed(`
      plot.new()
      plot.window(c(0, 2), c(0, 2))
      image <- as.raster(matrix(c("#FF0000", "#00FF00", "#0000FF", "#FFFFFF"), 2, 2))
      rasterImage(image, 0, 0, 2, 2, interpolate = FALSE)
    `);
    const event = rendered.graphics[2];
    expect(event?.kind).toBe("raster");
    if (event?.kind === "raster") {
      expect([...event.rgba]).toEqual([
        255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
      ]);
    }

    await expect(runtime.eval("as.raster(list(1))")).rejects.toMatchObject({ code: "NRE2216" });
    await expect(runtime.eval("as.raster(1 + 1i)")).rejects.toMatchObject({ code: "NRE2216" });
    await expect(runtime.eval("as.raster(c(-1, 0, 2), max = 1)")).rejects.toMatchObject({
      code: "NRT3298",
    });
    await expect(runtime.eval("as.raster(1, max = NA_real_)")).rejects.toMatchObject({
      code: "NRT3331",
    });
    await expect(runtime.eval("as.raster(array(1, c(1, 1, 2)))")).rejects.toMatchObject({
      code: "NRT3331",
    });
    await expect(runtime.eval("as.raster(array(c(NA, 0, 0), c(1, 1, 3)))")).rejects.toMatchObject({
      code: "NRT3298",
    });
    await runtime.dispose();
  });

  it("selects usage-ranked planar convex hulls across coordinate input forms", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- chull(c(0, 1, 1, 0), c(0, 0, 1, 1))\nb <- chull(c(0, 2, 3, 1, -1, 1), c(0, 0, 2, 4, 2, 2))\nc(typeof(a), is.null(names(a)), a, b)",
      ),
    ).resolves.toEqual(["integer", "TRUE", "2", "1", "4", "3", "2", "1", "5", "4", "3"]);
    await expect(
      runtime.eval(
        "m <- matrix(c(0, 1, 1, 0, 0, 0, 1, 1), ncol = 2)\na <- chull(m)\nb <- chull(c(0 + 0i, 1 + 0i, 0 + 1i))\nc <- chull(c(3, 1, 2, 0))\nd <- chull(1:3, 1:2)\nc(a, b, c, d)",
      ),
    ).resolves.toEqual([2, 1, 4, 3, 2, 1, 3, 4, 2, 1, 3, 3, 1, 2]);
    await expect(
      runtime.eval(
        "a <- chull(c(2, 0, 3, 1), rep(1, 4))\nb <- chull(c(2, 0, 3, 1), c(2, 0, 3, 1))\nc <- chull(rep(4, 3), rep(9, 3))\nd <- chull(data.frame(a = c(0, 1, 0), b = c(0, 0, 1)))\nc(a, b, c, length(chull(NULL)), d)",
      ),
    ).resolves.toEqual([2, 3, 2, 3, 1, 0, 2, 1, 3]);
    await expect(runtime.eval("chull(c(0, 1, NA), c(0, 1, 2))")).rejects.toMatchObject({
      code: "NRT3260",
    });
    await expect(runtime.eval("chull(list(a = 1:2, b = 1:2))")).rejects.toMatchObject({
      code: "NRT3260",
    });
    await runtime.dispose();
  });

  it("reorders grouped factor levels through usage-ranked scores and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- factor(c('b', 'a', 'b', 'c', 'a'), levels = c('a', 'b', 'c'))\ny <- reorder(x, c(5, 2, 1, 9, 4), mean)\ns <- attr(y, 'scores')\nc(as.integer(y), levels(y), s, dim(s), dimnames(s)[[1]], class(y))",
      ),
    ).resolves.toEqual([
      "2",
      "1",
      "2",
      "3",
      "1",
      "a",
      "b",
      "c",
      "3",
      "3",
      "9",
      "3",
      "a",
      "b",
      "c",
      "factor",
    ]);
    await expect(
      runtime.eval(
        "a <- reorder(ordered(c('b', 'a', 'c', 'a'), levels = c('a', 'b', 'c')), c(4, 2, 1, 6), mean)\nb <- reorder(factor(c('a', 'b', 'c')), c(1, 3, 2), mean, order = TRUE, decreasing = TRUE)\nc(as.integer(a), levels(a), class(a), as.integer(b), levels(b), class(b))",
      ),
    ).resolves.toEqual([
      "3",
      "2",
      "1",
      "2",
      "c",
      "a",
      "b",
      "ordered",
      "factor",
      "3",
      "1",
      "2",
      "b",
      "c",
      "a",
      "ordered",
      "factor",
    ]);
    await expect(
      runtime.eval(
        "x <- factor(c('a', 'b', NA, 'a', 'b', 'c'), levels = c('a', 'b', 'c', 'unused'))\ny <- reorder(x, c(1, NA, 99, 3, 5, NA), mean, na.rm = TRUE)\ns <- attr(y, 'scores')\nc(as.integer(y), levels(y), s[1:2], is.nan(s[3]), is.na(s[4]))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      NA,
      "1",
      "2",
      "3",
      "a",
      "b",
      "c",
      "unused",
      "2",
      "5",
      "TRUE",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "y <- reorder(c(a = 'b', b = 'a', c = 'b'), c(1, 100, 3), mean)\nc(as.integer(y), levels(y), names(y), attr(y, 'scores'))",
      ),
    ).resolves.toEqual(["1", "2", "1", "b", "a", "a", "b", "c", "100", "2"]);
    await expect(
      runtime.eval(
        "y <- reorder(NULL, numeric(), mean)\nc(length(y), length(levels(y)), length(attr(y, 'scores')), class(y))",
      ),
    ).resolves.toEqual(["0", "0", "0", "factor"]);
    await runtime.eval(
      "reorder.custom <- function(x, ..., marker = 'default') c(marker, list(...)[['extra']])\nNULL",
    );
    await expect(
      runtime.eval("reorder(structure(1:3, class = 'custom'), marker = 'ok', extra = 'dot')"),
    ).resolves.toEqual(["ok", "dot"]);
    await expect(runtime.eval("reorder(factor(c('a', 'b')), 1:3, mean)")).rejects.toMatchObject({
      code: "NRT3259",
    });
    await expect(
      runtime.eval("reorder(factor(c('a', 'a', 'b', 'b')), 1:4, range)"),
    ).rejects.toMatchObject({ code: "NRT3259" });
    await runtime.dispose();
  });

  it("factorizes numeric intervals through frequency-ranked cut semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- cut(c(0, 1, 2, 3), c(0, 1, 2, 3))\nb <- cut(c(0, 1, 2, 3), c(0, 1, 2, 3), include.lowest = TRUE)\nc(as.integer(a), levels(a), as.integer(b), levels(b))",
      ),
    ).resolves.toEqual([
      NA,
      "1",
      "2",
      "3",
      "(0,1]",
      "(1,2]",
      "(2,3]",
      "1",
      "1",
      "2",
      "3",
      "[0,1]",
      "(1,2]",
      "(2,3]",
    ]);
    await expect(
      runtime.eval(
        "a <- cut(c(0, 1, 2, 3), c(0, 1, 2, 3), right = FALSE)\nb <- cut(c(0, 1, 2, 3), c(0, 1, 2, 3), right = FALSE, include.lowest = TRUE)\nc(as.integer(a), levels(a), as.integer(b), levels(b))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      NA,
      "[0,1)",
      "[1,2)",
      "[2,3)",
      "1",
      "2",
      "3",
      "3",
      "[0,1)",
      "[1,2)",
      "[2,3]",
    ]);
    await expect(
      runtime.eval(
        "x <- cut(c(a = 0.5, b = 1.5, c = 9), c(2, 0, 1), labels = FALSE)\nc(x, typeof(x), is.null(names(x)))",
      ),
    ).resolves.toEqual(["1", "2", NA, "integer", "TRUE"]);
    await expect(
      runtime.eval(
        "x <- cut(c(0.5, 1.5, NA, NaN), c(0, 1, 2), labels = c('low', 'high'), ordered_result = TRUE)\nc(as.integer(x), levels(x), class(x))",
      ),
    ).resolves.toEqual(["1", "2", NA, NA, "low", "high", "ordered", "factor"]);
    await expect(
      runtime.eval(
        "x <- cut(c(0.5, 1.5), c(0, 1, 2), labels = c('same', 'same'))\nc(as.integer(x), levels(x))",
      ),
    ).resolves.toEqual(["1", "1", "same"]);

    await expect(
      runtime.eval(
        "x <- cut(c(0, 5, 10), breaks = 3)\ny <- cut(rep(5, 3), breaks = 4)\nc(as.integer(x), levels(x), as.integer(y), levels(y))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "(-0.01,3.33]",
      "(3.33,6.67]",
      "(6.67,10]",
      "2",
      "2",
      "2",
      "(4.995,4.998]",
      "(4.998,5]",
      "(5,5.002]",
      "(5.002,5.005]",
    ]);
    await runtime.eval(
      "cut.custom <- function(x, ..., breaks) c('custom', as.character(breaks))\nNULL",
    );
    await expect(
      runtime.eval("cut(structure(1:3, class = 'custom'), breaks = 4)"),
    ).resolves.toEqual(["custom", "4"]);
    await expect(runtime.eval("cut(1:3, c(0, 1, 1, 3))")).rejects.toMatchObject({
      code: "NRT3253",
    });
    await expect(runtime.eval("cut(1:3, breaks = 1)")).rejects.toMatchObject({
      code: "NRT3253",
    });
    await expect(runtime.eval("cut(c('1', '2'), c(0, 1, 2))")).rejects.toMatchObject({
      code: "NRT3253",
    });
    await expect(
      runtime.eval("cut(1:3, c(0, 1, 2, 3), labels = c('a', 'b'))"),
    ).rejects.toMatchObject({ code: "NRT3253" });
    await runtime.dispose();
  });

  it("encodes frequency-ranked atomic runs with GNU R missing-value boundaries", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- rle(c(1L, 1L, 2L, 2L, 2L, 1L))\nc(x$lengths, x$values, class(x), names(x))",
      ),
    ).resolves.toEqual(["2", "3", "1", "1", "2", "1", "rle", "lengths", "values"]);
    await expect(
      runtime.eval(
        "x <- rle(c(TRUE, TRUE, NA, NA, FALSE, FALSE))\nc(x$lengths, is.na(x$values), as.character(x$values))",
      ),
    ).resolves.toEqual([
      "2",
      "1",
      "1",
      "2",
      "FALSE",
      "TRUE",
      "TRUE",
      "FALSE",
      "TRUE",
      NA,
      NA,
      "FALSE",
    ]);
    await expect(
      runtime.eval(
        "x <- rle(c(1, NaN, NaN, NA, NA, Inf, Inf, -0, 0))\nc(x$lengths, is.nan(x$values), is.na(x$values))",
      ),
    ).resolves.toEqual([1, 1, 1, 1, 1, 2, 2, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0]);
    await expect(
      runtime.eval(
        "x <- rle(c(a = 'x', b = 'x', c = 'y'))\ny <- rle(as.raw(c(1, 1, 2)))\nc(x$lengths, x$values, is.null(names(x$values)), y$lengths, as.integer(y$values))",
      ),
    ).resolves.toEqual(["2", "1", "x", "y", "TRUE", "2", "1", "1", "2"]);
    await expect(
      runtime.eval("x <- rle(integer())\nc(length(x$lengths), length(x$values), typeof(x$values))"),
    ).resolves.toEqual(["0", "0", "integer"]);
    await expect(runtime.eval("rle(structure(1:3, tag = 'x'))")).rejects.toMatchObject({
      code: "NRT3254",
    });
    await expect(runtime.eval("rle(matrix(1:4, 2))")).rejects.toMatchObject({ code: "NRT3254" });
    await expect(runtime.eval("rle(factor(c('a', 'a')))")).rejects.toMatchObject({
      code: "NRT3254",
    });
    await expect(runtime.eval("rle(list(1, 1))")).rejects.toMatchObject({ code: "NRT3254" });
    await runtime.dispose();
  });

  it("coerces owned values through frequency-ranked as.vector modes", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- structure(matrix(c(a = 1L, b = 2L, c = 3L, d = 4L), 2), tag = 'x')\ny <- as.vector(x)\nd <- as.vector(structure(c(a = 1, b = 2), class = 'Date', tag = 'x'))\nc(y, typeof(y), is.null(names(y)), is.null(dim(y)), is.null(attr(y, 'tag')), d, is.null(attr(d, 'class')), is.null(names(d)))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "3",
      "4",
      "integer",
      "TRUE",
      "TRUE",
      "TRUE",
      "1",
      "2",
      "TRUE",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "f <- factor(c('b', 'a', NA))\no <- ordered(c('b', 'a', NA))\nc(as.vector(f), as.vector(o), as.vector(f, 'integer'), typeof(as.vector(f, 'double')), as.vector(f, 'logical'))",
      ),
    ).resolves.toEqual(["b", "a", NA, "b", "a", NA, "2", "1", NA, "double", NA, NA, NA]);
    await expect(
      runtime.eval(
        "z <- as.vector(c(1.5, NaN), 'complex')\nc(as.vector(c(TRUE, NA), 'integer'), as.vector(c(1L, NA_integer_), 'numeric'), Re(z), Im(z), as.vector(c(1L, NA_integer_), 'character'))",
      ),
    ).resolves.toEqual(["1", NA, "1", NA, "1.5", "NaN", "0", "0", "1", NA]);

    const logical = await runtime.evalDetailed("as.vector(c('TRUE', '0', 'x', NA), 'logical')");
    expect(logical.value).toEqual([true, NA, NA, NA]);
    const integer = await runtime.evalDetailed("as.vector(c('1', '1.9', 'x', NA), 'integer')");
    expect(integer.value).toEqual([1, 1, NA, NA]);
    expect(integer.warnings).toMatchObject([{ code: "NRW1006" }]);
    const complex = await runtime.evalDetailed("as.vector(c('1+2i', 'x', NA), 'complex')");
    expect(complex.value).toEqual([{ __nativr__: "complex", real: 1, imaginary: 2 }, NA, NA]);
    expect(complex.warnings).toMatchObject([{ code: "NRW1006" }]);
    const raw = await runtime.evalDetailed("as.vector(c(0, 1, 255, 256, NA), 'raw')");
    expect(raw.value).toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([0, 1, 255, 0, 0]),
    });
    expect(raw.warnings).toMatchObject([{ code: "NRW1004" }]);

    await expect(
      runtime.eval(
        "x <- structure(list(a = 1L, b = 'x'), class = 'custom', tag = 'kept')\ny <- as.vector(x)\np <- as.vector(x, 'pairlist')\na <- as.vector(setNames(c(1L, NA_integer_), c('a', 'b')), 'list')\nc(class(y), attr(y, 'tag'), names(y), class(p), attr(p, 'tag'), names(p), a[[1]], is.na(a[[2]]), names(a), is.null(attr(a, 'tag')))",
      ),
    ).resolves.toEqual([
      "custom",
      "kept",
      "a",
      "b",
      "custom",
      "kept",
      "a",
      "b",
      "1",
      "TRUE",
      "a",
      "b",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "f <- as.vector(factor(c('b', 'a', NA)), 'list')\nc(as.integer(f[[1]]), class(f[[1]]), levels(f[[1]]), is.na(f[[3]]))",
      ),
    ).resolves.toEqual(["2", "factor", "a", "b", "TRUE"]);
    await expect(
      runtime.eval(
        "p <- as.vector(setNames(1:2, c('a', 'b')), 'pairlist')\ne <- as.vector(c(1L, NA_integer_), 'expression')\nc(typeof(p), length(p), names(p), p$a, p$b, typeof(e), length(e), identical(e, expression(1L, NA_integer_)))",
      ),
    ).resolves.toEqual(["pairlist", "2", "a", "b", "1", "2", "expression", "2", "TRUE"]);
    await expect(
      runtime.eval(
        "d <- as.vector(data.frame(a = 1:2))\nc(typeof(d), class(d), names(d), length(d[[1]]), as.vector(quote(x), 'character'), as.vector(quote(1 + 2), 'character'), identical(as.vector(quote(1 + 2)), quote(1 + 2)))",
      ),
    ).resolves.toEqual(["list", "list", "a", "2", "x", "+", "1", "2", "TRUE"]);
    await expect(
      runtime.eval(
        "c(as.vector(quote(-x), 'character'), as.vector(quote(x <- 1), 'character'), as.vector(quote(x[1]), 'character'), as.vector(quote(pkg::member), 'character'), as.vector(quote(if (x) 1 else 2), 'character'))",
      ),
    ).resolves.toEqual([
      "-",
      "x",
      "<-",
      "x",
      "1",
      "[",
      "x",
      "1",
      "::",
      "pkg",
      "member",
      "if",
      "x",
      "1",
      "2",
    ]);
    await expect(
      runtime.eval(
        "x <- as.vector(quote(f(a = 1, 2)), 'list')\ny <- as.vector(quote(1 + 2), 'list')\nc(names(x), is.null(names(y)), typeof(x[[1]]), x[[2]], x[[3]])",
      ),
    ).resolves.toEqual(["", "a", "", "TRUE", "symbol", "1", "2"]);
    await expect(
      runtime.eval(
        "c(is.null(as.vector(NULL)), typeof(as.vector(NULL, 'logical')), typeof(as.vector(NULL, 'double')), typeof(as.vector(NULL, 'complex')), typeof(as.vector(NULL, 'raw')), length(as.vector(NULL, 'list')), typeof(as.vector(NULL, 'expression')), length(as.vector(NULL, 'expression')), is.null(as.vector(NULL, 'pairlist')))",
      ),
    ).resolves.toEqual([
      "TRUE",
      "logical",
      "double",
      "complex",
      "raw",
      "0",
      "expression",
      "1",
      "TRUE",
    ]);
    await expect(runtime.eval("as.vector(1:3, 'bogus')")).rejects.toMatchObject({
      code: "NRT3246",
    });
    await expect(runtime.eval("as.vector(1:3, c('integer', 'double'))")).rejects.toMatchObject({
      code: "NRT3246",
    });
    await expect(runtime.eval("as.vector(list(1:2, 3:4), 'integer')")).rejects.toMatchObject({
      code: "NRT3246",
    });
    await expect(runtime.eval("as.vector(quote(1 + 2), 'pairlist')")).rejects.toMatchObject({
      code: "NRT3246",
    });
    await expect(runtime.eval("as.vector(quote(x), 'pairlist')")).rejects.toMatchObject({
      code: "NRT3246",
    });
    await runtime.dispose();
  });

  it("decodes frequency-ranked integer code points with GNU R-compatible UTF-8 boundaries", async () => {
    const runtime = await session();
    await expect(runtime.eval("intToUtf8(c(65L, 66L, 0x20acL, 0x1f600L))")).resolves.toBe("AB€😀");
    await expect(
      runtime.eval("intToUtf8(c(65L, 66L, 0x20acL, 0x1f600L), multiple = TRUE)"),
    ).resolves.toEqual(["A", "B", "€", "😀"]);
    await expect(
      runtime.eval("intToUtf8(c(65L, 0L, 66L, NA_integer_), multiple = TRUE)"),
    ).resolves.toEqual(["A", "", "B", NA]);
    await expect(runtime.eval("intToUtf8(c(65L, 0L, 66L, NA_integer_))")).resolves.toBe(NA);
    await expect(runtime.eval("intToUtf8(integer())")).resolves.toBe("");
    await expect(runtime.eval("intToUtf8(integer(), multiple = TRUE)")).resolves.toEqual([]);

    await expect(
      runtime.eval(
        "c(intToUtf8(c(65.9, 66.1), multiple = TRUE), intToUtf8(as.raw(c(65, 66)), multiple = TRUE), intToUtf8(c('65', '66'), multiple = TRUE), intToUtf8(list(65L, 66L), multiple = TRUE))",
      ),
    ).resolves.toEqual(["A", "B", "A", "B", "A", "B", "A", "B"]);
    await expect(
      runtime.eval(
        "x <- intToUtf8(structure(c(a = 65L, b = 66L), class = 'custom', tag = 'x'), multiple = TRUE)\nc(x, is.null(names(x)), is.null(attr(x, 'tag')))",
      ),
    ).resolves.toEqual(["A", "B", "TRUE", "TRUE"]);

    const nonfinite = await runtime.evalDetailed("intToUtf8(c(NaN, Inf, -Inf), multiple = TRUE)");
    expect(nonfinite.value).toEqual([NA, NA, NA]);
    expect(nonfinite.warnings).toMatchObject([{ code: "NRW1007" }]);
    const characters = await runtime.evalDetailed(
      "intToUtf8(c('65.9', ' 66 ', '', 'x', NA_character_), multiple = TRUE)",
    );
    expect(characters.value).toEqual(["A", "B", NA, NA, NA]);
    expect(characters.warnings).toMatchObject([{ code: "NRW1006" }]);
    const complex = await runtime.evalDetailed("intToUtf8(c(65 + 2i, 66 + 0i), multiple = TRUE)");
    expect(complex.value).toEqual(["A", "B"]);
    expect(complex.warnings).toMatchObject([{ code: "NRW1005" }]);

    await expect(
      runtime.eval("intToUtf8(c(-1L, 65L, 0x110000L), multiple = TRUE)"),
    ).resolves.toEqual([NA, "A", NA]);
    await expect(runtime.eval("intToUtf8(c(0xd83dL, 0xde00L))")).resolves.toBe(NA);
    await expect(
      runtime.eval("intToUtf8(c(0xd83dL, 0xde00L), allow_surrogate_pairs = TRUE)"),
    ).resolves.toBe("😀");
    const ignoredPairs = await runtime.evalDetailed(
      "intToUtf8(c(0xd83dL, 0xde00L), multiple = TRUE, allow_surrogate_pairs = TRUE)",
    );
    expect(ignoredPairs.value).toEqual([NA, NA]);
    expect(ignoredPairs.warnings).toMatchObject([{ code: "NRW1015" }]);

    await expect(
      runtime.eval("intToUtf8(c(65L, 66L), multiple = c(TRUE, FALSE))"),
    ).resolves.toEqual(["A", "B"]);
    await expect(runtime.eval("intToUtf8(c(65L, 66L), multiple = 'FALSE')")).resolves.toBe("AB");
    await expect(
      runtime.eval("intToUtf8(factor(c('A', 'B')), multiple = TRUE)"),
    ).rejects.toMatchObject({ code: "NRT3247" });
    await expect(
      runtime.eval("intToUtf8(list(65:66, 67L), multiple = TRUE)"),
    ).rejects.toMatchObject({ code: "NRT3247" });
    await expect(runtime.eval("intToUtf8(65L, multiple = NA)")).rejects.toMatchObject({
      code: "NRT3247",
    });
    await expect(runtime.eval("intToUtf8(65L, multiple = 'x')")).rejects.toMatchObject({
      code: "NRT3247",
    });
    await runtime.dispose();
  });

  it("constructs and extracts frequency-ranked diagonal matrices", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- diag(3L)\nb <- diag(c(2L, 4L, 6L))\nc(typeof(a), dim(a), a, typeof(b), dim(b), b)",
      ),
    ).resolves.toEqual([
      "double",
      "3",
      "3",
      "1",
      "0",
      "0",
      "0",
      "1",
      "0",
      "0",
      "0",
      "1",
      "integer",
      "3",
      "3",
      "2",
      "0",
      "0",
      "0",
      "4",
      "0",
      "0",
      "0",
      "6",
    ]);
    await expect(
      runtime.eval("x <- diag(c(1L, 2L), nrow = 3, ncol = 4)\nc(typeof(x), dim(x), x)"),
    ).resolves.toEqual([
      "integer",
      "3",
      "4",
      "1",
      "0",
      "0",
      "0",
      "2",
      "0",
      "0",
      "0",
      "1",
      "0",
      "0",
      "0",
    ]);
    await expect(
      runtime.eval(
        "a <- diag(c(TRUE, NA))\nb <- diag(c(1 + 2i, 3 + 4i))\nr <- diag(as.raw(c(2, 4)))\nf <- diag(factor(c('b', 'a')))\nc(typeof(a), a, Re(b), Im(b), typeof(r), as.integer(r), typeof(f), f)",
      ),
    ).resolves.toEqual([
      "logical",
      "TRUE",
      "FALSE",
      "FALSE",
      NA,
      "1",
      "0",
      "0",
      "3",
      "2",
      "0",
      "0",
      "4",
      "raw",
      "2",
      "0",
      "0",
      "4",
      "integer",
      "2",
      "0",
      "0",
      "1",
    ]);
    await expect(
      runtime.eval(
        "m <- matrix(1:9, 3, dimnames = list(c('a', 'b', 'c'), c('a', 'b', 'c')))\nx <- diag(m)\ny <- diag(m, names = FALSE)\nc(x, names(x), y, is.null(names(y)))",
      ),
    ).resolves.toEqual(["1", "5", "9", "a", "b", "c", "1", "5", "9", "TRUE"]);
    await expect(
      runtime.eval(
        "m <- matrix(c('a', 'b', 'c', 'd'), 2)\nl <- matrix(list(1L, 'x', TRUE, 4), 2)\nc(diag(m), typeof(diag(l)), unlist(diag(l)))",
      ),
    ).resolves.toEqual(["a", "d", "list", "1", "4"]);
    await expect(
      runtime.eval(
        "c(dim(diag(nrow = 2L, ncol = 3L)), diag(nrow = 2L, ncol = 3L), dim(diag(integer())))",
      ),
    ).resolves.toEqual([2, 3, 1, 0, 0, 1, 0, 0, 0, 0]);

    const character = await runtime.evalDetailed("diag(c('2', 'x'))");
    expect(character.value).toEqual([2, 0, 0, NA]);
    expect(character.warnings).toMatchObject([{ code: "NRW1006" }]);
    await expect(runtime.eval("diag()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("diag(integer(), nrow = 1)")).rejects.toMatchObject({
      code: "NRT3248",
    });
    await expect(runtime.eval("diag(array(1:8, c(2, 2, 2)))")).rejects.toMatchObject({
      code: "NRT3248",
    });
    await expect(runtime.eval("diag(matrix(1:4, 2), nrow = 2)")).rejects.toMatchObject({
      code: "NRT3248",
    });
    await expect(runtime.eval("diag(data.frame(x = 1:2, y = 3:4))")).rejects.toMatchObject({
      code: "NRT3248",
    });
    await expect(runtime.eval("diag(matrix(1:4, 2), names = NA)")).rejects.toMatchObject({
      code: "NRT3248",
    });
    await runtime.dispose();
  });

  it("implements the frequency-prioritized initial condition-system slice", async () => {
    const runtime = await session();

    const message = await runtime.evalDetailed('message("alpha", 2)');
    expect(message.value).toBeNull();
    expect(message.visible).toBe(false);
    expect(message.output).toEqual([{ stream: "message", text: "alpha2\n" }]);

    const warning = await runtime.evalDetailed('warning("careful", call. = FALSE)');
    expect(warning.value).toBe("careful");
    expect(warning.visible).toBe(false);
    expect(warning.warnings).toEqual([{ code: "NRW1100", message: "careful" }]);

    const attempted = await runtime.evalDetailed('try(stop("boom", call. = FALSE))');
    expect(attempted.value).toBe("Error : boom\n");
    expect(attempted.visible).toBe(false);
    expect(attempted.output).toEqual([{ stream: "stderr", text: "Error : boom\n" }]);
    await expect(
      runtime.eval(
        'failed <- try(stop("quiet", call. = FALSE), silent = TRUE)\nc(inherits(failed, "try-error"), conditionMessage(attr(failed, "condition")))',
      ),
    ).resolves.toEqual(["TRUE", "quiet"]);

    const suppressed = await runtime.evalDetailed(
      'suppressWarnings({ warning("hidden"); 3 })\nsuppressMessages({ message("hidden"); 4 })',
    );
    expect(suppressed.value).toBe(4);
    expect(suppressed.warnings).toEqual([]);
    expect(suppressed.output).toEqual([]);

    await expect(
      runtime.eval(
        'tracker <- new.env()\ntracker$value <- 0\nvalue <- tryCatch(stop("caught", call. = FALSE), error = function(e) conditionMessage(e), finally = tracker$value <- 1)\nc(value, tracker$value)',
      ),
    ).resolves.toEqual(["caught", "1"]);
    const assertions = await runtime.evalDetailed("stopifnot(TRUE, 1 == 1)");
    expect(assertions.value).toBeNull();
    expect(assertions.visible).toBe(false);
    await expect(
      runtime.eval("tryCatch(stopifnot(FALSE), error = function(e) conditionMessage(e))"),
    ).resolves.toBe("FALSE is not TRUE");

    const registered = await runtime.evalDetailed(
      "trace <- character()\nglobalCallingHandlers(warning = function(c) trace <<- c(trace, paste0('w:', conditionMessage(c))))",
    );
    expect(registered.value).toBeNull();
    expect(registered.visible).toBe(false);
    await expect(
      runtime.eval(
        "globalCallingHandlers(condition = function(c) trace <<- c(trace, paste0('c:', class(c)[1])))\nc(names(globalCallingHandlers()), length(globalCallingHandlers()))",
      ),
    ).resolves.toEqual(["condition", "warning", "2"]);
    const globallyHandled = await runtime.evalDetailed(
      "suppressWarnings(warning('hidden', call. = FALSE))\nwarning('shown', call. = FALSE)\ntrace",
    );
    expect(globallyHandled.value).toEqual(["c:simpleWarning", "w:shown"]);
    expect(globallyHandled.warnings).toEqual([{ code: "NRW1100", message: "shown" }]);

    await runtime.eval(
      "globalCallingHandlers(message = function(c) trace <<- c(trace, paste0('m:', conditionMessage(c))))",
    );
    const globallyMessaged = await runtime.evalDetailed("message('note')\ntrace");
    expect(globallyMessaged.value).toEqual([
      "c:simpleWarning",
      "w:shown",
      "m:note",
      "c:simpleMessage",
    ]);
    expect(globallyMessaged.output).toEqual([{ stream: "message", text: "note\n" }]);

    await runtime.eval(
      "globalCallingHandlers(NULL)\ntrace <- character()\nglobalCallingHandlers(error = function(c) trace <<- c(trace, paste0('e:', conditionMessage(c))))",
    );
    await expect(
      runtime.eval("tryCatch(stop('caught', call. = FALSE), error = function(c) NULL)\ntrace"),
    ).resolves.toEqual([]);
    await expect(runtime.eval("stop('unhandled', call. = FALSE)")).rejects.toMatchObject({
      code: "NRE2300",
    });
    await expect(runtime.eval("trace")).resolves.toBe("e:unhandled");
    await expect(
      runtime.eval(
        "previous <- globalCallingHandlers(NULL)\nc(length(previous), length(globalCallingHandlers()))",
      ),
    ).resolves.toEqual([1, 0]);
    await expect(runtime.eval("globalCallingHandlers(function(c) NULL)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await expect(runtime.eval("globalCallingHandlers(warning = 1)")).rejects.toMatchObject({
      code: "NRT3250",
    });

    const hidden = await runtime.evalDetailed("invisible(7)");
    expect(hidden.value).toBe(7);
    expect(hidden.visible).toBe(false);

    const literalVisibility = await runtime.evalDetailed("withVisible(1)");
    expect(literalVisibility.value).toEqual([1, true]);
    expect(literalVisibility.visible).toBe(true);
    expect(literalVisibility.raw).toMatchObject({
      type: "list",
      names: ["value", "visible"],
    });
    await expect(runtime.eval("withVisible(x <- 2)")).resolves.toEqual([2, false]);
    await expect(runtime.eval("withVisible(invisible(3))")).resolves.toEqual([3, false]);
    await expect(runtime.eval("withVisible({ 1; invisible(4) })")).resolves.toEqual([4, false]);
    await expect(runtime.eval("withVisible(withVisible(invisible(5)))")).resolves.toEqual([
      [5, false],
      true,
    ]);
    await expect(runtime.eval("(function(x) withVisible(x))(invisible(6))")).resolves.toEqual([
      6,
      false,
    ]);
    await expect(
      runtime.eval("(function(x) { force(x); withVisible(x) })(invisible(7))"),
    ).resolves.toEqual([7, true]);
    await expect(runtime.eval("(function(...) withVisible(...))(invisible(8))")).resolves.toEqual([
      8,
      false,
    ]);
    await expect(
      runtime.eval("(function(...) { list(...); withVisible(...) })(invisible(9))"),
    ).resolves.toEqual([9, true]);
    await expect(runtime.eval("withVisible(evalq(invisible(10)))")).resolves.toEqual([10, false]);
    await expect(runtime.evalDetailed("(function(x) x)(invisible(11))")).resolves.toMatchObject({
      value: 11,
      visible: false,
    });
    await expect(runtime.eval("withVisible()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("withVisible(1, 2)")).rejects.toMatchObject({ code: "NRE2101" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxSteps: 50 },
    });
    await expect(limited.eval("try(while (TRUE) 1, silent = TRUE)")).rejects.toMatchObject({
      code: "NRL4001",
    });
    await limited.dispose();
  });

  it("keeps frequency-prioritized options as resettable session state", async () => {
    const runtime = await session();
    await expect(
      runtime.eval('c(getOption("digits"), getOption("definitely.missing", 42))'),
    ).resolves.toEqual([7, 42]);
    await expect(runtime.eval("interactive()")).resolves.toBe(false);
    await expect(
      runtime.eval('tracker <- 0\ngetOption("digits", { tracker <- 1; 99 })\ntracker'),
    ).resolves.toBe(0);

    const changed = await runtime.evalDetailed("options(nativr.test = 1, digits = 10)");
    expect(changed.value).toEqual([null, 7]);
    expect(changed.visible).toBe(false);
    await expect(runtime.eval('c(getOption("nativr.test"), getOption("digits"))')).resolves.toEqual(
      [1, 10],
    );

    const queried = await runtime.evalDetailed('options(c("digits", "nativr.test"))');
    expect(queried.value).toEqual([10, 1]);
    expect(queried.visible).toBe(true);
    expect(queried.raw).toMatchObject({ type: "list", names: ["digits", "nativr.test"] });

    await runtime.eval('options(list(nativr.a = 2, nativr.b = "x"))');
    await expect(runtime.eval('c(getOption("nativr.a"), getOption("nativr.b"))')).resolves.toEqual([
      "2",
      "x",
    ]);
    await runtime.eval("options(nativr.test = NULL)");
    await expect(runtime.eval('getOption("nativr.test")')).resolves.toBeNull();

    const printed = await runtime.evalDetailed("options(digits = 3)\nprint(1 / 3)");
    expect(printed.output).toEqual([{ stream: "stdout", text: "[1] 0.333\n" }]);
    await expect(runtime.eval("options(digits = 23)")).rejects.toMatchObject({ code: "NRT3223" });

    await runtime.reset();
    await expect(
      runtime.eval('c(getOption("digits"), is.null(getOption("nativr.a")))'),
    ).resolves.toEqual([7, 1]);
    await runtime.dispose();
  });

  it("reports browser-safe R capabilities with GNU R name and selection shapes", async () => {
    const runtime = await session();
    const capabilityNames = [
      "jpeg",
      "png",
      "tiff",
      "tcltk",
      "X11",
      "aqua",
      "http/ftp",
      "sockets",
      "libxml",
      "fifo",
      "cledit",
      "iconv",
      "NLS",
      "Rprof",
      "profmem",
      "cairo",
      "ICU",
      "long.double",
      "libcurl",
    ];
    await expect(runtime.eval("names(capabilities())")).resolves.toEqual(capabilityNames);
    await expect(
      runtime.eval(
        "c(typeof(capabilities()), length(capabilities()), all(!capabilities()), capabilities(c('cairo', 'profmem', 'unknown')))",
      ),
    ).resolves.toEqual(["logical", "19", "TRUE", "FALSE", "FALSE"]);
    await expect(
      runtime.eval(
        "c(names(capabilities(c('cairo', 'unknown', 'cairo'))), names(capabilities(factor(c('profmem', 'cairo')))), length(capabilities(character())), length(capabilities(NULL)))",
      ),
    ).resolves.toEqual(["cairo", "cairo", "profmem", "cairo", "0", "19"]);
    await expect(
      runtime.eval(
        "tracker <- new.env()\ntracker$forced <- FALSE\ncapabilities('cairo', Xchk = { tracker$forced <- TRUE; stop('forced') })\nc(tracker$forced, length(capabilities('unknown')))",
      ),
    ).resolves.toEqual([0, 0]);
    await expect(runtime.eval("capabilities('cairo', unused = TRUE)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await runtime.dispose();
  });

  it("reports deterministic browser locale categories and monetary conventions", async () => {
    const runtime = await session();
    const names = [
      "decimal_point",
      "thousands_sep",
      "grouping",
      "int_curr_symbol",
      "currency_symbol",
      "mon_decimal_point",
      "mon_thousands_sep",
      "mon_grouping",
      "positive_sign",
      "negative_sign",
      "int_frac_digits",
      "frac_digits",
      "p_cs_precedes",
      "p_sep_by_space",
      "n_cs_precedes",
      "n_sep_by_space",
      "p_sign_posn",
      "n_sign_posn",
    ];
    await expect(runtime.eval("names(Sys.localeconv())")).resolves.toEqual(names);
    await expect(runtime.eval("unname(Sys.localeconv())")).resolves.toEqual([
      ".",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "127",
      "127",
      "127",
      "127",
      "127",
      "127",
      "127",
      "127",
    ]);
    await expect(runtime.eval("base::Sys.localeconv()[['decimal_point']]")).resolves.toBe(".");
    await expect(runtime.eval("base::.LC.categories")).resolves.toEqual([
      "LC_ALL",
      "LC_COLLATE",
      "LC_CTYPE",
      "LC_MONETARY",
      "LC_NUMERIC",
      "LC_TIME",
      "LC_MESSAGES",
      "LC_PAPER",
      "LC_MEASUREMENT",
    ]);
    await expect(
      runtime.eval(
        "Sys.setlocale('LC_MONETARY', 'it_IT')\nx <- Sys.localeconv()\nc(Sys.getlocale('LC_MONETARY'), x[['int_curr_symbol']], x[['currency_symbol']], x[['mon_decimal_point']], x[['mon_thousands_sep']], x[['p_cs_precedes']], x[['p_sep_by_space']])",
      ),
    ).resolves.toEqual(["it_IT", "EUR", "€", ",", ".", "0", "1"]);
    await expect(
      runtime.eval(
        "Sys.setlocale('LC_MONETARY', 'en_US.UTF-8')\nx <- Sys.localeconv()\nc(Sys.getlocale(), x[['int_curr_symbol']], x[['currency_symbol']], x[['mon_decimal_point']], x[['mon_thousands_sep']], x[['n_sign_posn']])",
      ),
    ).resolves.toEqual([
      "LC_COLLATE=C;LC_CTYPE=C;LC_MONETARY=en_US.UTF-8;LC_NUMERIC=C;LC_TIME=C",
      "USD",
      "$",
      ".",
      ",",
      "0",
    ]);
    await expect(runtime.eval("Sys.getlocale('LC_MON')")).rejects.toMatchObject({
      code: "NRE2134",
    });
    const unsupported = await runtime.evalDetailed("Sys.setlocale('LC_MONETARY', 'fr_FR')");
    expect(unsupported.value).toBe("");
    expect(unsupported.warnings).toEqual([
      {
        code: "NRW1021",
        message: "OS reports request to set locale to 'fr_FR' cannot be honored",
      },
    ]);
    await expect(runtime.eval("Sys.localeconv(1)")).rejects.toMatchObject({ code: "NRE2101" });
    await runtime.reset();
    await expect(runtime.eval("Sys.getlocale()")).resolves.toBe("C");
    await runtime.dispose();
  });

  it("reports deterministic browser-native session information through utils", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- utils::sessionInfo()\nc(x$platform, x$R.version$major, x$R.version$minor, x$locale, x$tzone, x$tzcode_type, x$running, x$RNGkind, x$basePkgs, class(x), length(x$loadedOnly), length(x))",
      ),
    ).resolves.toEqual([
      "wasm32-unknown-browser/nativr",
      "4",
      "6.0",
      "C",
      "UTC",
      "internal",
      "Browser JavaScript (NativR)",
      "Mersenne-Twister",
      "Inversion",
      "Rejection",
      "stats",
      "graphics",
      "grDevices",
      "utils",
      "datasets",
      "methods",
      "base",
      "sessionInfo",
      "0",
      "13",
    ]);
    await expect(
      runtime.eval(
        "Sys.setlocale('LC_MONETARY', 'en_US.UTF-8')\nRNGkind(sample.kind = 'Rounding')\nx <- sessionInfo()\nc(x$locale, x$RNGkind)",
      ),
    ).resolves.toEqual([
      "LC_COLLATE=C;LC_CTYPE=C;LC_MONETARY=en_US.UTF-8;LC_NUMERIC=C;LC_TIME=C",
      "Mersenne-Twister",
      "Inversion",
      "Rounding",
    ]);
    await expect(runtime.eval("sessionInfo(package = 'base')")).rejects.toMatchObject({
      code: "NRU6149",
    });
    await runtime.dispose();
  });

  it("returns the canonical NA marker and distinguishes NaN", async () => {
    const runtime = await session();
    const missing = await runtime.eval("mean(c(1, NA, 3))");
    expect(isNA(missing)).toBe(true);
    expect(await runtime.eval("is.na(c(1, NA, NaN))")).toEqual([false, true, true]);
    expect(await runtime.eval("is.nan(c(1, NA, NaN))")).toEqual([false, false, true]);
    await runtime.dispose();
  });

  it("evaluates and transports complex literals, vectors, arithmetic, and missingness", async () => {
    const runtime = await session();
    const scalar = await runtime.eval("1 + 2i");
    expect(isComplex(scalar)).toBe(true);
    expect(scalar).toEqual({ __nativr__: "complex", real: 1, imaginary: 2 });
    await expect(runtime.eval("(1 + 2i) * (3 - 4i)")).resolves.toEqual({
      __nativr__: "complex",
      real: 11,
      imaginary: 2,
    });
    await expect(runtime.eval("c(1 + 2i, 3 - 4i)[2]")).resolves.toEqual({
      __nativr__: "complex",
      real: 3,
      imaginary: -4,
    });
    await expect(runtime.eval("mean(c(1 + 2i, 3 + 4i))")).resolves.toEqual({
      __nativr__: "complex",
      real: 2,
      imaginary: 3,
    });
    await expect(runtime.eval("sqrt(-1 + 0i)")).resolves.toEqual({
      __nativr__: "complex",
      real: 0,
      imaginary: 1,
    });
    await expect(runtime.eval("is.na(c(1i, NA_complex_, NaN + 1i))")).resolves.toEqual([
      false,
      true,
      true,
    ]);
    await expect(runtime.eval("complex(real = c(1, 2), imaginary = 3)")).resolves.toEqual([
      { __nativr__: "complex", real: 1, imaginary: 3 },
      { __nativr__: "complex", real: 2, imaginary: 3 },
    ]);
    await expect(runtime.eval("c(Re(3 + 4i), Im(3 + 4i), Mod(3 + 4i))")).resolves.toEqual([
      3, 4, 5,
    ]);
    await expect(runtime.eval("Conj(3 + 4i)")).resolves.toEqual({
      __nativr__: "complex",
      real: 3,
      imaginary: -4,
    });
    await expect(runtime.eval('as.complex(c("1+2i", "-3i"))')).resolves.toEqual([
      { __nativr__: "complex", real: 1, imaginary: 2 },
      { __nativr__: "complex", real: 0, imaginary: -3 },
    ]);
    await expect(runtime.eval("is.complex(1 + 0i)")).resolves.toBe(true);
    await expect(runtime.eval("complex(modulus = 2, argument = 0)")).resolves.toEqual({
      __nativr__: "complex",
      real: 2,
      imaginary: 0,
    });
    await expect(runtime.eval("Conj(c(1, 2))")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("sum(c(NA, 1i), na.rm = FALSE)")).resolves.toEqual(NA);
    await runtime.dispose();
  });

  it("constructs, coerces, transports, subsets, and operates on raw vectors", async () => {
    const runtime = await session();
    const raw = await runtime.eval("as.raw(c(0, 1, 255))");
    expect(isRaw(raw)).toBe(true);
    expect(raw).toEqual({ __nativr__: "raw", bytes: new Uint8Array([0, 1, 255]) });
    await expect(runtime.eval("!as.raw(c(0, 1, 255))")).resolves.toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([255, 254, 0]),
    });
    await expect(runtime.eval("as.raw(c(1, 2)) & as.raw(c(3, 1))")).resolves.toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([1, 0]),
    });
    await expect(runtime.eval("x <- as.raw(c(1, 2, 3)); x[2] <- as.raw(255); x")).resolves.toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([1, 255, 3]),
    });
    await expect(runtime.eval('rawToChar(charToRaw("NativR"))')).resolves.toBe("NativR");
    await expect(runtime.eval("rawShift(as.raw(c(1, 128)), 1)")).resolves.toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([2, 0]),
    });
    await expect(runtime.eval("rawToBits(as.raw(c(1, 128)))")).resolves.toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
    });
    await expect(runtime.eval("as.logical(rawToBits(as.raw(c(1, 128))))")).resolves.toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    await expect(runtime.eval("rawToBits(1L)")).rejects.toMatchObject({ code: "NRT3305" });
    await expect(runtime.eval("is.raw(raw(2))")).resolves.toBe(true);
    const coerced = await runtime.evalDetailed("as.raw(c(-1, 256, NA, NaN))");
    expect(coerced.value).toEqual({
      __nativr__: "raw",
      bytes: new Uint8Array([0, 0, 0, 0]),
    });
    expect(coerced.warnings).toMatchObject([{ code: "NRW1004" }]);
    await runtime.dispose();
  });

  it("reports storage types and implements core atomic coercions", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'c(typeof(NULL), typeof(TRUE), typeof(1L), typeof(1), typeof(1i), typeof(as.raw(1)), typeof("x"), typeof(list(1)), typeof(function() 1), typeof(~x))',
      ),
    ).resolves.toEqual([
      "NULL",
      "logical",
      "integer",
      "double",
      "complex",
      "raw",
      "character",
      "list",
      "closure",
      "language",
    ]);
    await expect(
      runtime.eval(
        "c(mode(NULL), mode(1L), mode(1), mode(1i), mode(as.raw(1)), mode(function() 1), mode(~x))",
      ),
    ).resolves.toEqual(["NULL", "numeric", "numeric", "complex", "raw", "function", "call"]);
    await expect(
      runtime.eval(
        'c(is.null(NULL), is.logical(TRUE), is.integer(1L), is.double(1), is.numeric(1L), is.numeric(1i), is.character("x"), is.atomic(NULL), is.atomic(as.raw(1)), is.list(list()), is.function(function() 1))',
      ),
    ).resolves.toEqual([true, true, true, true, true, false, true, false, true, true, true]);
    await expect(
      runtime.eval(
        'c(is.vector(setNames(1, "x")), is.vector(structure(1, class = "x")), is.vector(1L, "numeric"), is.vector(1, "integer"), is.vector(NULL), is.vector(NULL, "NULL"))',
      ),
    ).resolves.toEqual([true, false, true, false, false, true]);

    await expect(
      runtime.eval('c(as.logical(c(0, 1, NA, NaN)), as.logical(c("TRUE", "f", "x")))'),
    ).resolves.toEqual([false, true, NA, NA, true, false, NA]);
    const integers = await runtime.evalDetailed('as.integer(c(1.9, -1.9, NA, NaN, Inf, "bad"))');
    expect(integers.value).toEqual([1, -1, NA, NA, NA, NA]);
    expect(integers.warnings).toMatchObject([{ code: "NRW1006" }, { code: "NRW1007" }]);
    const real = await runtime.evalDetailed("as.double(c(1 + 2i, NA_complex_))");
    expect(real.value).toEqual([1, NA]);
    expect(real.warnings).toMatchObject([{ code: "NRW1005" }]);
    await expect(
      runtime.eval("c(as.character(TRUE), as.character(1 + 2i), as.character(NA_complex_))"),
    ).resolves.toEqual(["TRUE", "1+2i", NA]);
    await expect(
      runtime.eval('c(as.character(factor(c("a", "b"))), as.logical(factor(c("TRUE", "FALSE"))))'),
    ).resolves.toEqual(["a", "b", "TRUE", "FALSE"]);
    await runtime.dispose();
  });

  it("covers type and coercion edge cases without weakening NA/NaN distinctions", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("c(typeof(mean), mode(mean), mode(TRUE), mode(list()))"),
    ).resolves.toEqual(["builtin", "function", "logical", "list"]);
    await expect(
      runtime.eval(
        'c(is.vector(as.raw(1), "raw"), is.vector(list(1), "list"), is.vector("x", "numeric"), is.vector(factor("x")))',
      ),
    ).resolves.toEqual([true, true, false, false]);
    await expect(runtime.eval("as.logical(NULL)")).resolves.toEqual([]);
    await expect(
      runtime.eval(
        "as.logical(c(complex(real = 0, imaginary = 0), complex(real = 0, imaginary = 1), complex(real = NaN), NA_complex_))",
      ),
    ).resolves.toEqual([false, true, NA, NA]);
    await expect(
      runtime.eval('as.logical(factor(c("TRUE", "FALSE", "other", NA)))'),
    ).resolves.toEqual([true, false, NA, NA]);
    await expect(runtime.eval("as.integer(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval("as.integer(as.raw(c(1, 255)))")).resolves.toEqual([1, 255]);
    const parsedIntegers = await runtime.evalDetailed('as.integer(c("0x10", "", "1e2"))');
    expect(parsedIntegers.value).toEqual([16, NA, 100]);
    expect(parsedIntegers.warnings).toMatchObject([{ code: "NRW1006" }]);
    const complexIntegers = await runtime.evalDetailed(
      "as.integer(c(complex(real = 1), complex(real = 1, imaginary = 2), complex(real = NaN)))",
    );
    expect(complexIntegers.value).toEqual([1, 1, NA]);
    expect(complexIntegers.warnings).toMatchObject([{ code: "NRW1005" }]);
    await expect(runtime.eval("as.double(NULL)")).resolves.toEqual([]);
    const parsedDoubles = await runtime.evalDetailed('as.double(c("Inf", "NaN", "bad"))');
    expect(parsedDoubles.value).toEqual([Number.POSITIVE_INFINITY, Number.NaN, NA]);
    expect(parsedDoubles.warnings).toMatchObject([{ code: "NRW1006" }]);
    await expect(
      runtime.eval("as.double(complex(real = c(1, 1), imaginary = c(0, NaN)))"),
    ).resolves.toEqual([1, NA]);
    await expect(runtime.eval("as.character(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval("as.character(as.raw(c(0, 15, 255)))")).resolves.toEqual([
      "00",
      "0f",
      "ff",
    ]);
    await expect(runtime.eval("as.character(c(NaN, Inf, -Inf, -0))")).resolves.toEqual([
      "NaN",
      "Inf",
      "-Inf",
      "0",
    ]);
    await runtime.dispose();
  });

  it("constructs empty-mode vectors and reports recursive shape predicates", async () => {
    const runtime = await session();
    await expect(runtime.eval("logical(3)")).resolves.toEqual([false, false, false]);
    await expect(runtime.eval("integer(2)")).resolves.toEqual([0, 0]);
    await expect(runtime.eval("double(2)")).resolves.toEqual([0, 0]);
    await expect(runtime.eval("numeric(2)")).resolves.toEqual([0, 0]);
    await expect(runtime.eval("character(2)")).resolves.toEqual(["", ""]);
    await expect(runtime.eval('vector("list", 2)')).resolves.toEqual([null, null]);
    await expect(runtime.eval('is.complex(vector("complex", 2))')).resolves.toBe(true);
    await expect(runtime.eval('is.raw(vector("raw", 2))')).resolves.toBe(true);
    await expect(runtime.eval("lengths(list(1:2, NULL, 'x'))")).resolves.toEqual([2, 0, 1]);
    await expect(runtime.eval("c(length(function() 1), length(~x))")).resolves.toEqual([1, 2]);
    await expect(
      runtime.eval(
        "c(is.matrix(matrix(1:4, 2)), is.array(array(1:4, c(2, 2, 1))), is.data.frame(data.frame(x = 1)), is.factor(factor('a')), is.recursive(list(1)), is.recursive(1:2))",
      ),
    ).resolves.toEqual([true, true, true, true, true, false]);
    await expect(runtime.eval('vector("unsupported", 1)')).rejects.toMatchObject({
      code: "NRE2139",
    });
    await runtime.dispose();
  });

  it("collects one non-multiple recycling warning", async () => {
    const runtime = await session();
    const result = await runtime.evalDetailed("c(1, 2, 3) + c(10, 20)");
    expect(result.value).toEqual([11, 22, 13]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe("NRW1001");
    await runtime.dispose();
  });

  it("assigns typed arrays and supports get and call", async () => {
    const runtime = await session();
    await runtime.assign("x", new Float64Array([1, 2, 3, 4]));
    expect(await runtime.eval("mean(x)")).toBe(2.5);
    expect(await runtime.get("x")).toEqual([1, 2, 3, 4]);
    expect(await runtime.call("mean", [2, 4])).toBe(3);
    await runtime.assign("missing", [1, NA, 3]);
    expect(await runtime.eval("mean(missing, na.rm = TRUE)")).toBe(2);
    await runtime.dispose();
  });

  it("uses lexical closure capture, defaults, and lazy supplied promises", async () => {
    const runtime = await session();
    expect(await runtime.eval("y <- 3\nf <- function(x = y) x ^ 2\ny <- 4\nf()")).toBe(16);
    expect(await runtime.eval("f <- function(x) 2\nf(not.bound)")).toBe(2);
    await runtime.dispose();
  });

  it("supports rightward and non-local assignment", async () => {
    const runtime = await session();
    await expect(runtime.eval("1 -> x\nx")).resolves.toBe(1);
    await expect(runtime.eval("x <- 1\nf <- function() x <<- 2\nf()\nx")).resolves.toBe(2);
    await expect(
      runtime.eval(
        "outer <- function() { x <- 1; inner <- function() x <<- x + 1; inner(); x }\nouter()",
      ),
    ).resolves.toBe(2);
    await expect(
      runtime.eval("x <- c(1, 2, 3)\nf <- function() x[2] <<- 20\nf()\nx"),
    ).resolves.toEqual([1, 20, 3]);
    await expect(runtime.eval("4 -> x[2]\nx")).resolves.toEqual([1, 4, 3]);
    await expect(runtime.eval("sum <<- 1")).rejects.toMatchObject({ code: "NRE2012" });
    await runtime.dispose();
  });

  it("matches exact names before unique partial names for closures and builtins", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("f <- function(alpha, beta) alpha + beta\nf(al = 1, b = 2)"),
    ).resolves.toBe(3);
    await expect(runtime.eval("mean(c(1, NA, 3), na.r = TRUE)")).resolves.toBe(2);
    await expect(runtime.eval("f <- function(..., alpha = 1) alpha\nf(al = 2)")).resolves.toBe(1);
    await expect(runtime.eval("f <- function(apple, apricot) 1\nf(ap = 1)")).rejects.toMatchObject({
      code: "NRE2007",
    });
    await runtime.dispose();
  });

  it("tracks omitted, defaulted, forwarded, and forced missing arguments", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("f <- function(x) missing(x)\nc(f(), f(1), f(x =))"),
    ).resolves.toEqual([true, false, true]);
    await expect(runtime.eval("f <- function(x = 1) c(missing(x), x)\nf()")).resolves.toEqual([
      1, 1,
    ]);
    await expect(
      runtime.eval("g <- function(y) missing(y)\nf <- function(x) g(x)\nc(f(), f(1))"),
    ).resolves.toEqual([true, false]);
    await expect(runtime.eval("f <- function(x) 2\nf()")).resolves.toBe(2);
    await expect(runtime.eval("f <- function(x) x\nf()")).rejects.toMatchObject({
      code: "NRE2006",
    });
    await runtime.dispose();
  });

  it("forces selected promises, invokes calls from lists, and installs delayed bindings", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "e <- new.env()\ne$marker <- 0\nf <- function(x, y) c(x, e$marker)\nforceAndCall(1, f, { e$marker <- 1; 10 }, { e$marker <- 2; 20 })",
      ),
    ).resolves.toEqual([10, 1]);
    await expect(runtime.eval("forceAndCall(1, function(x, y) x, 1 + 1, not.bound)")).resolves.toBe(
      2,
    );
    await expect(
      runtime.eval(
        'f <- function(alpha, beta = 2) alpha + beta\nc(do.call(f, list(alpha = 3, beta = 4)), do.call("mean", list(c(1, 3))))',
      ),
    ).resolves.toEqual([7, 2]);
    await expect(
      runtime.eval(
        'source <- 10\ne <- new.env()\ndelayedAssign("x", { source <- source + 1; source }, eval.env = globalenv(), assign.env = e)\nc(source, e$x, e$x, source)',
      ),
    ).resolves.toEqual([10, 11, 11, 11]);
    await expect(
      runtime.eval(
        'f <- function() { y <- 10; delayedAssign("x", { y <- y + 1; y }); c(x, x, y) }\nf()',
      ),
    ).resolves.toEqual([11, 11, 11]);
    await expect(runtime.eval("names(identity(c(a = 1, b = 2)))")).resolves.toEqual(["a", "b"]);
    await expect(runtime.eval('do.call("identity", list(1), quote = TRUE)')).rejects.toMatchObject({
      code: "NRU6135",
    });
    await expect(runtime.eval("do.call(sum, pairlist(1, 2))")).rejects.toMatchObject({
      code: "NRT3214",
    });
    await expect(runtime.eval("forceAndCall(0, function(x) 1, not.bound)")).resolves.toBe(1);
    await expect(runtime.eval("forceAndCall(5, function(x) x, 3)")).resolves.toBe(3);
    await expect(runtime.eval("force()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("identity()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval('do.call("not.a.function", list())')).rejects.toMatchObject({
      code: "NRE2001",
    });
    await expect(runtime.eval("do.call(1, list())")).rejects.toMatchObject({ code: "NRT3214" });
    await expect(runtime.eval("do.call(identity, list(1), envir = 1)")).rejects.toMatchObject({
      code: "NRT3214",
    });
    await expect(runtime.eval('delayedAssign("", 1)')).rejects.toMatchObject({ code: "NRE2007" });
    await expect(runtime.eval('delayedAssign("x", 1, eval.env = 1)')).rejects.toMatchObject({
      code: "NRT3214",
    });
    await runtime.dispose();
  });

  it("selects switch branches lazily with names, positions, defaults, and fall-through", async () => {
    const runtime = await session();
    await expect(runtime.eval('switch("b", a = not.bound, b = 2, 3)')).resolves.toBe(2);
    await expect(runtime.eval('switch("missing", a = 1, 3)')).resolves.toBe(3);
    await expect(runtime.eval("switch(2.9, a = not.bound, b = 2, 3)")).resolves.toBe(2);
    await expect(runtime.eval('switch("a", a = , b = 2, 3)')).resolves.toBe(2);
    await expect(runtime.eval('switch("missing", a = 1)')).resolves.toBeNull();
    await expect(runtime.eval('switch("x", a = 1, 2, 3)')).rejects.toMatchObject({
      code: "NRE2138",
    });
    await runtime.dispose();
  });

  it("exposes visibility, raw snapshots, reset, and capabilities", async () => {
    const runtime = await session();
    const assignment = await runtime.evalDetailed("x <- 2");
    expect(assignment.visible).toBe(false);
    expect(await runtime.evalRaw("x")).toMatchObject({
      version: 1,
      type: "double",
      values: new Float64Array([2]),
    });
    const capabilities = await runtime.capabilities();
    expect(capabilities.languageSubsetVersion).toBe("0.193.0");
    expect(capabilities.syntax).toMatchObject({
      atomicCoercion: "supported",
      formula: "supported",
      pipe: "supported",
      quotedEvaluation: "supported",
      expressionVectors: "supported",
      callConstruction: "supported",
      substitution: "supported",
      firstClassOperators: "supported",
      matchedCalls: "supported",
      environments: "supported",
      pairlists: "supported",
      textParsing: "supported",
      dynamicEvaluation: "supported",
      replacementFunctions: "supported",
      switchSelection: "supported",
      typeInspection: "supported",
      s3ClassMetadata: "supported",
      s3MethodDispatch: "supported",
    });
    expect(capabilities.packages.find((entry) => entry.name === "graphics")?.functions).toEqual([
      { name: "plot.new", compatibility: "behavioral" },
      { name: "plot.window", compatibility: "shape" },
      { name: "matplot", compatibility: "shape" },
      { name: "axTicks", compatibility: "behavioral" },
      { name: "box", compatibility: "shape" },
      { name: "boxplot", compatibility: "shape" },
      { name: "rasterImage", compatibility: "shape" },
      { name: "segments", compatibility: "shape" },
      { name: "points", compatibility: "shape" },
      { name: "text", compatibility: "shape" },
      { name: "polygon", compatibility: "shape" },
      { name: "legend", compatibility: "shape" },
      { name: "persp", compatibility: "shape" },
      { name: "pairs", compatibility: "shape" },
    ]);
    await runtime.reset();
    await expect(runtime.get("x")).rejects.toMatchObject({ code: "NRE2001" });
    await runtime.dispose();
  });

  it("rejects future operations after disposal", async () => {
    const runtime = await session();
    await runtime.dispose();
    await expect(runtime.eval("1 + 1")).rejects.toBeInstanceOf(RRuntimeDisposedError);
  });

  it("enforces configured output limits", async () => {
    const runtime = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 4 },
    });
    await expect(runtime.eval("c(1, 2)")).rejects.toMatchObject({ code: "NRL4007" });
    await runtime.dispose();
  });

  it("rounds zoo's usage-ranked plot limits to significant digits", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        z1 <- c(38.2, 18.1, 83.2, 42.7, 22.8, 48.1, 81.8, 129.6, 52.0, 110.3, NA)
        c(signif(max(na.omit(z1)), 2), signif(max(na.omit(z1) * 1.05), 2))
      `),
    ).resolves.toEqual([130, 140]);
    await expect(
      runtime.eval(`
        x <- structure(c(9.95, 9.85, 99.5, 98.5, .0995, .0985), marker = "kept")
        y <- signif(x, 2)
        c(y, attr(y, "marker"), typeof(signif(1:3)), signif(c(1.2345, 12.345), c(2.6, 4.2)))
      `),
    ).resolves.toEqual([
      "10",
      "9.8",
      "100",
      "98",
      "0.1",
      "0.098",
      "kept",
      "double",
      "1.23",
      "12.34",
    ]);
    await expect(
      runtime.eval(`
        x <- signif(rep(1.23456789, 8), c(1.49, 1.5, 2.49, 2.5, 3.5, 21.5, 22.5, -1.5))
        c(x, signif(c(1.2345, 12.345), c(-Inf, 0, .4, .5, 22.4, 22.5, 23, Inf)))
      `),
    ).resolves.toEqual([
      1, 1.2, 1.2, 1.23, 1.235, 1.23456789, 1.23456789, 1, 1, 10, 1, 10, 1.2345, 12.345, 1.2345,
      12.345,
    ]);
    await expect(
      runtime.eval(`
        c(
          identical(signif(-0, 3), -0),
          signif(Inf, 3) == Inf,
          is.nan(signif(1, NaN)),
          is.na(signif(1, NA_real_)),
          signif(1.23456789)
        )
      `),
    ).resolves.toEqual([1, 1, 1, 1, 1.23457]);
    await expect(
      runtime.eval(`
        z <- signif(c(9.95 + 0i, 1.25 + 9.95i, .995 + .0995i, Inf + 1i, NaN + 2i), 2)
        c(Re(z), Im(z))
      `),
    ).resolves.toEqual([9.9, 1.2, 1, Infinity, NaN, 0, 9.9, 0.1, 1, 2]);
    await runtime.eval(`
      signif.direct <- function(x, digits = 6) c(42, digits)
      Math.grouped <- function(x, ...) c(99, list(...)[[1]])
      NULL
    `);
    await expect(
      runtime.eval(
        "c(signif(structure(1, class = 'direct'), 3), signif(structure(1, class = 'grouped'), 4))",
      ),
    ).resolves.toEqual([42, 3, 99, 4]);
    await expect(runtime.eval("signif(factor(c('a', 'b')), 2)")).rejects.toMatchObject({
      code: "NRT3330",
    });
    await expect(runtime.eval("signif(1, numeric())")).rejects.toMatchObject({ code: "NRT3330" });
    await expect(runtime.eval("signif(list(1), 2)")).rejects.toMatchObject({ code: "NRT3102" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 8 },
    });
    await expect(limited.eval("signif(1:10, 2)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("covers the supported base builtin surface", async () => {
    const runtime = await session();
    await expect(runtime.eval("length(NULL)")).resolves.toBe(0);
    await expect(runtime.eval("length(c(1, 2, 3))")).resolves.toBe(3);
    await expect(runtime.eval("sum(1, 2, 3)")).resolves.toBe(6);
    await expect(runtime.eval("sum(c(1, NA, 3), na.rm = TRUE)")).resolves.toBe(4);
    await expect(runtime.eval("abs(c(-2, 3))")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("sqrt(c(4, 9))")).resolves.toEqual([2, 3]);
    await expect(
      runtime.eval("round(c(0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 1.005, 2.675), c(rep(0, 6), 2, 2))"),
    ).resolves.toEqual([0, 2, 2, -0, -2, -2, 1, 2.67]);
    await expect(runtime.eval("round(c(1.234, 2.345, 3.456), c(1, 2))")).resolves.toEqual([
      1.2, 2.35, 3.5,
    ]);
    await expect(
      runtime.eval('attr(round(structure(c(1.25, 2.25), foo = "bar"), 1), "foo")'),
    ).resolves.toBe("bar");
    await expect(
      runtime.evalRaw("round(matrix(c(1.25, 2.25), nrow = 1), 1)"),
    ).resolves.toMatchObject({ type: "double", dim: [1, 2] });
    await expect(runtime.eval("round(1.25 + 2.35i, 1)")).resolves.toEqual({
      __nativr__: "complex",
      real: 1.2,
      imaginary: 2.4,
    });
    await expect(runtime.eval("log(c(1, 8, 16), c(2, 4))")).resolves.toEqual([0, 1.5, 4]);
    await expect(runtime.eval("c(log10(100), log2(8))")).resolves.toEqual([2, 3]);
    const invalidLog = await runtime.evalDetailed("is.nan(log(-1))");
    expect(invalidLog.value).toBe(true);
    expect(invalidLog.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await expect(runtime.eval('attr(exp(structure(c(0, 1), foo = "bar")), "foo")')).resolves.toBe(
      "bar",
    );
    await expect(runtime.eval("c(log1p(1e-10), expm1(1e-10))")).resolves.toEqual([
      Math.log1p(1e-10),
      Math.expm1(1e-10),
    ]);
    const complexLog = await runtime.eval("log(1 + 1i)");
    expect(complexLog).toMatchObject({ __nativr__: "complex" });
    expect((complexLog as { real: number }).real).toBeCloseTo(Math.log(Math.SQRT2), 14);
    expect((complexLog as { imaginary: number }).imaginary).toBeCloseTo(Math.PI / 4, 14);
    await runtime.dispose();
  });

  it("coerces c() inputs through the documented atomic type ladder", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(TRUE, FALSE)")).resolves.toEqual([true, false]);
    await expect(runtime.eval("c(TRUE, 2L)")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("c(1L, 2.5)")).resolves.toEqual([1, 2.5]);
    await expect(runtime.eval('c(TRUE, 2, "three")')).resolves.toEqual(["TRUE", "2", "three"]);
    await runtime.dispose();
  });

  it("evaluates sequences and repetition with finite allocation accounting", async () => {
    const runtime = await session();
    await expect(runtime.eval("1:5")).resolves.toEqual([1, 2, 3, 4, 5]);
    await expect(runtime.eval("3:1")).resolves.toEqual([3, 2, 1]);
    await expect(runtime.eval("1.5:3.5")).resolves.toEqual([1.5, 2.5, 3.5]);
    await expect(runtime.eval("seq(1, 5, by = 2)")).resolves.toEqual([1, 3, 5]);
    await expect(runtime.eval("seq(2, 4, length.out = 3)")).resolves.toEqual([2, 3, 4]);
    await expect(runtime.eval("seq_len(3)")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("seq_along(c(4, 5, 6))")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("rep(c(1, 2), times = 2)")).resolves.toEqual([1, 2, 1, 2]);
    await expect(runtime.eval("rep(c(1, 2), each = 2)")).resolves.toEqual([1, 1, 2, 2]);
    await expect(runtime.eval("rep(c(1, 2), length.out = 5)")).resolves.toEqual([1, 2, 1, 2, 1]);
    await runtime.dispose();
  });

  it("constructs named lists and preserves exact names across snapshots", async () => {
    const runtime = await session();
    await expect(runtime.eval('list(1, "two", TRUE)')).resolves.toEqual([1, "two", true]);
    await expect(runtime.eval("x <- list(a = 1, b = c(2, 3))\nnames(x)")).resolves.toEqual([
      "a",
      "b",
    ]);
    await expect(runtime.eval("x$a")).resolves.toBe(1);
    await expect(runtime.eval("x$b")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("x$missing")).resolves.toBeNull();
    await expect(runtime.evalRaw("x")).resolves.toMatchObject({ type: "list", names: ["a", "b"] });
    await expect(runtime.eval('x <- setNames(c(10, 20), c("a", "b"))\nnames(x)')).resolves.toEqual([
      "a",
      "b",
    ]);
    await expect(runtime.evalRaw("x")).resolves.toMatchObject({
      type: "double",
      names: ["a", "b"],
    });
    await runtime.dispose();
  });

  it("combines named atomic arguments and selects their exact names", async () => {
    const runtime = await session();
    await expect(runtime.eval('x <- c(a = 10, b = 20, c = 30)\nx[c("c", "a")]')).resolves.toEqual([
      30, 10,
    ]);
    await expect(runtime.evalRaw("x")).resolves.toMatchObject({
      type: "double",
      names: ["a", "b", "c"],
    });
    await expect(
      runtime.eval(
        'x <- c(setNames(c(1, 2), c("x", "y")), group = setNames(c(3, 4), c("p", "q")), 5)\nnames(x)',
      ),
    ).resolves.toEqual(["x", "y", "group.p", "group.q", ""]);
    await expect(runtime.eval("c(NULL, NULL)")).resolves.toBeNull();
    await runtime.dispose();
  });

  it("subsets and extracts vectors and lists by position, mask, and R name matching", async () => {
    const runtime = await session();
    await runtime.eval('x <- setNames(c(10, 20, 30), c("a", "b", "c"))');
    await expect(runtime.eval("x[c(3, 1)]")).resolves.toEqual([30, 10]);
    await expect(runtime.eval("x[c(1.9, 3.1)]")).resolves.toEqual([10, 30]);
    await expect(runtime.eval("x[-1.9]")).resolves.toEqual([20, 30]);
    await expect(runtime.eval("x[[1.9]]")).resolves.toBe(10);
    await expect(runtime.eval("x[c(NaN, Inf)]")).resolves.toEqual([NA, NA]);
    await expect(runtime.eval("x[-2]")).resolves.toEqual([10, 30]);
    await expect(runtime.eval("x[c(TRUE, FALSE, TRUE)]")).resolves.toEqual([10, 30]);
    await expect(runtime.eval('x[c("b", "a")]')).resolves.toEqual([20, 10]);
    await expect(runtime.eval("x[[2]]")).resolves.toBe(20);
    await expect(runtime.eval('x[["c"]]')).resolves.toBe(30);
    await runtime.eval("items <- list(first = 1, second = c(2, 3))");
    await expect(runtime.eval("items[1]")).resolves.toEqual([1]);
    await expect(runtime.eval("items[[2]]")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("items$second")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("x[]")).resolves.toEqual([10, 20, 30]);
    await expect(runtime.eval("x[c(0, 2, 0)]")).resolves.toBe(20);
    await expect(runtime.eval("x[c(4, NA)]")).resolves.toEqual([NA, NA]);
    await expect(runtime.eval("x[c(TRUE, NA, FALSE)]")).resolves.toEqual([10, NA]);
    await expect(runtime.eval('x[c("missing", "a")]')).resolves.toEqual([NA, 10]);
    await expect(runtime.eval("c(10, 20)[FALSE]")).resolves.toEqual([]);
    await expect(runtime.eval("list(1)[2]")).resolves.toEqual([null]);
    await runtime.eval("items <- list(alpha = 1, alpine = 2, beta = 3)");
    await expect(runtime.eval("items$bet")).resolves.toBe(3);
    await expect(runtime.eval("items$al")).resolves.toBeNull();
    await expect(runtime.eval('items[["bet"]]')).resolves.toBeNull();
    await expect(runtime.eval('items[["bet", exact = FALSE]]')).resolves.toBe(3);
    await expect(runtime.eval('items[["al", exact = FALSE]]')).resolves.toBeNull();
    const warnedPartial = await runtime.evalDetailed('items[["bet", exact = NA]]');
    expect(warnedPartial.value).toBe(3);
    expect(warnedPartial.warnings).toMatchObject([{ code: "NRW1008" }]);
    await runtime.dispose();
  });

  it("covers the documented sequence, repetition, and names boundaries", async () => {
    const runtime = await session();
    await expect(runtime.eval("names(NULL)")).resolves.toBeNull();
    await expect(runtime.eval("names(c(1, 2))")).resolves.toBeNull();
    await expect(runtime.eval("names(list(1, b = 2))")).resolves.toEqual(["", "b"]);
    await expect(runtime.eval("seq(3)")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("seq(3, 1)")).resolves.toEqual([3, 2, 1]);
    await expect(runtime.eval("seq(2, 4, length.out = 1)")).resolves.toBe(2);
    await expect(runtime.eval("seq(2, 4, length.out = 0)")).resolves.toEqual([]);
    await expect(runtime.eval("seq(along.with = list(1, 2))")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("seq_along(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval("rep(NULL)")).resolves.toBeNull();
    await expect(runtime.eval("rep(c(1, 2), times = 0)")).resolves.toEqual([]);
    await expect(runtime.eval("seq(1, 3, by = 1, length.out = 3)")).rejects.toMatchObject({
      code: "NRE2104",
    });
    await expect(runtime.eval("seq(1, along.with = c(1, 2))")).rejects.toMatchObject({
      code: "NRU6107",
    });
    await expect(runtime.eval("rep(seq_len(0), length.out = 1)")).rejects.toMatchObject({
      code: "NRE2106",
    });
    await expect(runtime.eval('setNames(c(1, 2), c("a"))')).rejects.toMatchObject({
      code: "NRT3004",
    });
    await expect(runtime.eval('setNames(c(1, 2), c("a", NA))')).rejects.toMatchObject({
      code: "NRU6106",
    });
    await runtime.dispose();
  });

  it("returns stable subscript and sequence errors outside the supported subset", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(1, 2)[c(1, -2)]")).rejects.toMatchObject({ code: "NRE2201" });
    await expect(runtime.eval("c(1, 2)[[3]]")).rejects.toMatchObject({ code: "NRE2202" });
    await expect(runtime.eval('c(1, 2)[["missing"]]')).rejects.toMatchObject({ code: "NRE2202" });
    await expect(runtime.eval("c(1, 2)$x")).rejects.toMatchObject({ code: "NRT3304" });
    await expect(runtime.eval("c(1, 2)[c(-1, NA)]")).rejects.toMatchObject({ code: "NRE2203" });
    await expect(runtime.eval("c(1, 2)[[c(1, 2)]]")).rejects.toMatchObject({ code: "NRE2204" });
    await expect(runtime.eval("c(1, 2)[[0]]")).rejects.toMatchObject({ code: "NRE2205" });
    await expect(runtime.eval("1:NA")).rejects.toMatchObject({ code: "NRT3104" });
    await expect(runtime.eval("seq(1, 3, by = 0)")).rejects.toMatchObject({ code: "NRE2105" });
    await runtime.dispose();
  });

  it("preserves NA and NaN behavior across reductions and math", async () => {
    const runtime = await session();
    expect(isNA(await runtime.eval("sum(c(1, NA, 3))"))).toBe(true);
    expect(await runtime.eval("sum(c(1, NaN, 3))")).toBeNaN();
    expect(await runtime.eval("mean(c(NA, NaN), na.rm = TRUE)")).toBeNaN();
    const squareRoot = await runtime.evalDetailed("sqrt(c(-1, NA))");
    expect(squareRoot.value).toEqual([Number.NaN, NA]);
    expect(squareRoot.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await runtime.dispose();
  });

  it("returns stable argument and type errors for invalid builtin calls", async () => {
    const runtime = await session();
    await expect(runtime.eval("mean()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval('mean("x")')).rejects.toMatchObject({ code: "NRT3102" });
    await expect(runtime.eval("mean(1, na.rm = NA)")).rejects.toMatchObject({ code: "NRT3103" });
    await expect(runtime.eval("mean(1, extra = TRUE)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await expect(runtime.eval("sum(1, nope = TRUE)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await expect(runtime.eval("sum(1, na.rm = TRUE, na.rm = FALSE)")).rejects.toMatchObject({
      code: "NRE2102",
    });
    await expect(runtime.eval("c(list(1))")).rejects.toMatchObject({ code: "NRU6101" });
    await runtime.dispose();
  });

  it("evaluates arithmetic, comparison, and three-valued logical operators", async () => {
    const runtime = await session();
    await expect(runtime.eval("-c(1, 2)")).resolves.toEqual([-1, -2]);
    await expect(runtime.eval("!c(TRUE, FALSE)")).resolves.toEqual([false, true]);
    await expect(runtime.eval("!c(FALSE, NA, NaN)")).resolves.toEqual([true, NA, NA]);
    await expect(runtime.eval("c(2, 4) / 2")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("c(2L, 3L) * 2L")).resolves.toEqual([4, 6]);
    await expect(runtime.eval("c(-5L, 5L) %% 2L")).resolves.toEqual([1, 1]);
    await expect(runtime.eval("c(-5, 5) %/% 2")).resolves.toEqual([-3, 2]);
    await expect(runtime.eval("c(2, 3) - 1")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("c(1, 2, NA) <= 2")).resolves.toEqual([true, true, NA]);
    await expect(runtime.eval('c("beta", "alpha") > "alpha"')).resolves.toEqual([true, false]);
    await expect(runtime.eval('c(1, 2) == c("1", "3")')).resolves.toEqual([true, false]);
    await expect(runtime.eval("c(TRUE, NA) & c(NA, FALSE)")).resolves.toEqual([NA, false]);
    await expect(runtime.eval("c(FALSE, NA) | c(NA, TRUE)")).resolves.toEqual([NA, true]);
    await expect(runtime.eval("FALSE && not.bound")).resolves.toBe(false);
    await expect(runtime.eval("TRUE || not.bound")).resolves.toBe(true);
    await expect(runtime.eval("NA && FALSE")).resolves.toBe(false);
    expect(isNA(await runtime.eval("NA && TRUE"))).toBe(true);
    await expect(runtime.eval("NA || TRUE")).resolves.toBe(true);
    expect(isNA(await runtime.eval("NA || FALSE"))).toBe(true);
    await expect(runtime.eval("c(TRUE, FALSE) && TRUE")).rejects.toMatchObject({
      code: "NRT3113",
    });
    await expect(runtime.eval('"one" + 2')).rejects.toMatchObject({ code: "NRT3101" });
    await runtime.dispose();
  });

  it("evaluates conditionals and function-local return", async () => {
    const runtime = await session();
    await expect(runtime.eval("if (TRUE) 1 else 2")).resolves.toBe(1);
    await expect(runtime.eval("if (FALSE) 1 else 2")).resolves.toBe(2);
    await expect(runtime.eval("if (FALSE) 1")).resolves.toBeNull();
    await expect(
      runtime.eval("f <- function(x) { if (x < 0) return(-1); x * 2 }\nf(3)"),
    ).resolves.toBe(6);
    await expect(runtime.eval("f(-2)")).resolves.toBe(-1);
    await expect(
      runtime.eval("f <- function() { for (i in 1:3) if (i == 2) return(i); 0 }\nf()"),
    ).resolves.toBe(2);
    await expect(runtime.eval("f <- function() return()\nf()")).resolves.toBeNull();
    await expect(runtime.eval("if (NA) 1")).rejects.toMatchObject({ code: "NRE2207" });
    await expect(runtime.eval("if (c(TRUE, FALSE)) 1")).rejects.toMatchObject({ code: "NRT3113" });
    await expect(runtime.eval("return(1)")).rejects.toMatchObject({ code: "NRE2209" });
    await runtime.dispose();
  });

  it("runs bounded for, while, and repeat loops with break and next", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "total <- 0\nfor (i in 1:5) { if (i == 3) next; if (i == 5) break; total <- total + i }\ntotal",
      ),
    ).resolves.toBe(7);
    await expect(
      runtime.eval(
        "i <- 0\ntotal <- 0\nwhile (i < 4) { i <- i + 1; if (i == 2) next; total <- total + i }\ntotal",
      ),
    ).resolves.toBe(8);
    await expect(
      runtime.eval("i <- 0\nrepeat { i <- i + 1; if (i < 3) next; break }\ni"),
    ).resolves.toBe(3);
    await expect(
      runtime.eval("total <- 0\nfor (x in list(1, 2)) total <- total + x\ntotal"),
    ).resolves.toBe(3);
    await expect(runtime.eval("break")).rejects.toMatchObject({ code: "NRE2208" });
    await expect(runtime.eval("next")).rejects.toMatchObject({ code: "NRE2208" });
    await expect(runtime.eval("f <- function() break\nfor (i in 1:2) f()")).rejects.toMatchObject({
      code: "NRE2208",
    });
    await expect(runtime.eval("1 + 1")).resolves.toBe(2);
    await runtime.dispose();
  });

  it("charges unbounded loops against the evaluation step limit", async () => {
    const runtime = await createR({
      execution: "inline",
      assets,
      limits: { maxSteps: 25 },
    });
    await expect(runtime.eval("repeat {}")).rejects.toMatchObject({ code: "NRL4001" });
    await runtime.dispose();
  });

  it("resolves exact public and internal members from registered namespaces", async () => {
    const runtime = await session();
    await expect(runtime.eval("mean <- 100\nbase::mean(c(2, 4))")).resolves.toBe(3);
    await expect(runtime.eval('base::length(c("a", "b"))')).resolves.toBe(2);
    await expect(runtime.eval("base::.Machine$integer.max")).resolves.toBe(2_147_483_647);
    await expect(runtime.eval("stats::mean(c(2, 4))")).resolves.toBe(3);
    await expect(runtime.eval("tibble::tibble(x = 1:2)$x")).resolves.toEqual([1, 2]);
    await expect(runtime.eval('R6::R6Class("Box")$new() |> class()')).resolves.toEqual([
      "Box",
      "R6",
    ]);
    await expect(runtime.eval("f <- function(x) base::missing(x)\nf()")).resolves.toBe(true);
    await expect(runtime.eval("base:::mean(c(2, 4))")).resolves.toBe(3);
    await expect(runtime.eval("unknown::mean(c(2, 4))")).rejects.toMatchObject({
      code: "NRE2210",
    });
    await runtime.dispose();
  });

  it("provides session-local deterministic random generation and sampling", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("set.seed(123)\nx <- runif(4)\nset.seed(123)\nx == runif(4)"),
    ).resolves.toEqual([true, true, true, true]);
    await expect(runtime.eval("set.seed(7)\nrnorm(3, mean = 5, sd = 0)")).resolves.toEqual([
      5, 5, 5,
    ]);
    const firstSample = await runtime.eval("set.seed(99)\nsample(6, size = 4)");
    expect(firstSample).toHaveLength(4);
    await expect(runtime.eval("set.seed(99)\nsample(6, size = 4)")).resolves.toEqual(firstSample);
    await expect(
      runtime.eval("set.seed(2)\nsample(c(10, 20), size = 5, replace = TRUE)"),
    ).resolves.toHaveLength(5);
    await expect(runtime.eval("sample(2, size = 3)")).rejects.toMatchObject({ code: "NRE2112" });
    await expect(runtime.eval("sample(3, prob = c(1, 1, 1))")).resolves.toHaveLength(3);
    await expect(runtime.eval("runif(1, min = 2, max = 1)")).rejects.toMatchObject({
      code: "NRE2110",
    });
    await expect(runtime.eval("rnorm(1, sd = -1)")).rejects.toMatchObject({ code: "NRE2111" });
    await runtime.dispose();
  });

  it("generates zoo's usage-ranked log-normal flow through the session RNG", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        suppressWarnings(RNGversion("3.5.0"))
        set.seed(0)
        round(stats::rlnorm(8, mean = 1), 12)
      `),
    ).resolves.toEqual([
      9.611442203053, 1.961612108081, 10.27587857616, 9.702943775026, 4.115010700361,
      0.582777366095, 1.074046149912, 2.024412536848,
    ]);
    await expect(
      runtime.eval(`
        set.seed(123)
        c(round(rlnorm(c(10, 20, 30), meanlog = c(0, 1), sdlog = c(0, .5)), 12),
          length(rlnorm(2.9)),
          length(rlnorm(c(NA, NA, NA))))
      `),
    ).resolves.toEqual([1, 2.053944676702, 1, 2, 3]);
    await expect(
      runtime.eval(`
        set.seed(42)
        baseline <- runif(1)
        set.seed(42)
        constant <- rlnorm(3, 1, 0)
        after <- runif(1)
        c(constant, baseline == after, is.null(names(rlnorm(c(a = 1, b = 2)))))
      `),
    ).resolves.toEqual([Math.E, Math.E, Math.E, 1, 1]);

    const invalid = await runtime.evalDetailed(`
      rlnorm(
        7,
        meanlog = c(NA, NaN, 0, Inf, -Inf, 0, 0),
        sdlog = c(1, 1, -1, 0, 0, Inf, 0)
      )
    `);
    expect(invalid.value).toEqual([
      Number.NaN,
      Number.NaN,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      Number.NaN,
      1,
    ]);
    expect(invalid.warnings).toEqual([{ code: "NRW1003", message: "NAs produced" }]);

    const empty = await runtime.evalDetailed("rlnorm(3, numeric())");
    expect(empty.value).toEqual([NA, NA, NA]);
    expect(empty.warnings).toEqual([{ code: "NRW1003", message: "NAs produced" }]);
    await expect(runtime.eval("rlnorm(numeric())")).resolves.toEqual([]);
    await expect(runtime.eval("rlnorm(-1)")).rejects.toMatchObject({ code: "NRT3308" });
    await expect(runtime.eval("rlnorm(1, factor('a'))")).rejects.toMatchObject({
      code: "NRT3309",
    });
    await expect(runtime.eval("rlnorm()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 8 },
    });
    await expect(limited.eval("rlnorm(9)")).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("configures usage-ranked GNU R random kinds with a reproducible browser-native engine", async () => {
    const runtime = await session();
    await expect(runtime.eval("RNGkind()")).resolves.toEqual([
      "Mersenne-Twister",
      "Inversion",
      "Rejection",
    ]);

    const configured = await runtime.evalDetailed(
      "RNGkind('Mers', normal.kind = 'Inv', sample.kind = 'Round')",
    );
    expect(configured.value).toEqual(["Mersenne-Twister", "Inversion", "Rejection"]);
    expect(configured.visible).toBe(false);
    expect(configured.warnings).toEqual([
      expect.objectContaining({
        code: "NRW1107",
        message: "non-uniform 'Rounding' sampler used",
      }),
    ]);
    await expect(runtime.eval("RNGkind()")).resolves.toEqual([
      "Mersenne-Twister",
      "Inversion",
      "Rounding",
    ]);

    await expect(
      runtime.eval(
        "set.seed(123, kind = 'Mersenne-Twister', normal.kind = 'Inversion', sample.kind = 'Rejection')\nround(runif(3), 12)",
      ),
    ).resolves.toEqual([0.287577520125, 0.788305135444, 0.408976921812]);
    await expect(
      runtime.eval(
        "set.seed(123, kind = 'Mersenne-Twister', normal.kind = 'Inversion')\nround(rnorm(3), 12)",
      ),
    ).resolves.toEqual([-0.560475646552, -0.230177489483, 1.558708314149]);

    await expect(
      runtime.eval(
        "set.seed(1.9)\na <- runif(3)\nset.seed('1')\nb <- runif(3)\nset.seed(1)\nc <- runif(3)\nc(identical(a, c), identical(b, c))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(runtime.eval("RNGkind('K')")).rejects.toMatchObject({ code: "NRT3273" });
    await expect(runtime.eval("RNGkind('Wichmann-Hill')")).rejects.toMatchObject({
      code: "NRU6143",
    });
    await expect(runtime.eval("RNGkind('Knuth-TAOCP')")).rejects.toMatchObject({
      code: "NRU6143",
    });
    await expect(runtime.eval("RNGkind(normal.kind = 'Ahrens')")).rejects.toMatchObject({
      code: "NRU6143",
    });
    await expect(runtime.eval("RNGkind(1)")).rejects.toMatchObject({ code: "NRT3273" });
    await expect(runtime.eval("set.seed(NA_integer_)")).rejects.toMatchObject({
      code: "NRT3117",
    });
    await runtime.dispose();
  });

  it("selects versioned RNG defaults for zoo's reproducible pre-3.6 examples", async () => {
    const runtime = await session();
    const historical = await runtime.evalDetailed(
      "old <- suppressWarnings(RNGversion('3.5.0'))\nset.seed(1)\nc(old, RNGkind(), round(rnorm(3), 12))",
    );
    expect(historical.value).toEqual([
      "Mersenne-Twister",
      "Inversion",
      "Rejection",
      "Mersenne-Twister",
      "Inversion",
      "Rounding",
      "-0.626453810742",
      "0.183643324222",
      "-0.83562861241",
    ]);
    expect(historical.warnings).toEqual([]);

    const current = await runtime.evalDetailed(
      "old <- suppressWarnings(RNGversion(3.5))\nprevious <- RNGversion('99.0.0')\nc(old, previous, RNGkind())",
    );
    expect(current.value).toEqual([
      "Mersenne-Twister",
      "Inversion",
      "Rounding",
      "Mersenne-Twister",
      "Inversion",
      "Rounding",
      "Mersenne-Twister",
      "Inversion",
      "Rejection",
    ]);
    expect(current.visible).toBe(true);
    await expect(runtime.eval("RNGversion('garbage')")).rejects.toMatchObject({ code: "NRT3274" });
    await expect(runtime.eval("RNGversion('1.6.2')")).rejects.toMatchObject({ code: "NRU6158" });
    await expect(runtime.eval("RNGversion()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();
  });

  it("samples bare integer ranges through usage-ranked sample.int semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(.Machine$integer.max, .Machine$double.base, .Machine$double.digits, length(.Machine))",
      ),
    ).resolves.toEqual([2_147_483_647, 2, 53, 29]);
    await expect(runtime.eval("set.seed(123)\nsample.int(.Machine$integer.max, 1L)")).resolves.toBe(
      1_235_143_119,
    );
    await expect(runtime.eval("set.seed(123)\nsample.int(5)")).resolves.toEqual([3, 2, 5, 4, 1]);
    await expect(runtime.eval("set.seed(123)\nsample.int(10, 6)")).resolves.toEqual([
      3, 10, 2, 8, 6, 9,
    ]);
    await expect(runtime.eval("set.seed(123)\nsample.int(10, 6, TRUE)")).resolves.toEqual([
      3, 3, 10, 2, 6, 5,
    ]);
    await expect(runtime.eval("set.seed(2)\nsample.int(10, 5, useHash = FALSE)")).resolves.toEqual([
      5, 6, 9, 1, 10,
    ]);
    await expect(runtime.eval("set.seed(2)\nsample.int(10, 5, useHash = TRUE)")).resolves.toEqual([
      5, 6, 8, 1, 9,
    ]);
    await expect(
      runtime.eval("set.seed(123)\nsample.int(1e10, 4, replace = TRUE)"),
    ).resolves.toEqual([8_334_216_106, 8_127_876_395, 4_109_595_662, 6_754_409_050]);
    await expect(
      runtime.eval("set.seed(123)\nsample.int(3, 8, TRUE, c(1, 2, 3))"),
    ).resolves.toEqual([3, 2, 3, 1, 1, 3, 2, 1]);
    await expect(
      runtime.eval("set.seed(123)\nsample.int(4, 3, FALSE, c(1, 2, 3, 4))"),
    ).resolves.toEqual([4, 2, 3]);
    await expect(
      runtime.eval(
        "c(typeof(sample.int(2^31 - 1, 0)), typeof(sample.int(2^31, 0)), length(sample.int(0, 0)))",
      ),
    ).resolves.toEqual(["integer", "double", "0"]);
    await expect(runtime.eval("sample.int(5, '2')")).resolves.toHaveLength(2);
    await expect(runtime.eval("sample.int(0, 1)")).rejects.toMatchObject({ code: "NRE2130" });
    await expect(runtime.eval("sample.int(5, 6)")).rejects.toMatchObject({ code: "NRE2112" });
    await expect(runtime.eval("sample.int(20, 5, TRUE, useHash = TRUE)")).rejects.toMatchObject({
      code: "NRE2131",
    });
    await expect(
      runtime.eval("sample.int(20, 5, prob = rep(1, 20), useHash = TRUE)"),
    ).rejects.toMatchObject({ code: "NRE2132" });
    await expect(runtime.eval("sample.int(20, 11, useHash = TRUE)")).rejects.toMatchObject({
      code: "NRE2133",
    });
    await expect(runtime.eval("sample.int(c(5, 6), 2)")).rejects.toMatchObject({
      code: "NRT3274",
    });
    await runtime.dispose();
  });

  it("jitters numeric vectors through the usage-ranked session-local RNG surface", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- structure(matrix(1:4, 2, dimnames = list(c('r1', 'r2'), c('a', 'b'))), marker = 'kept')\ny <- jitter(x, factor = 0)\nc(typeof(y), y, dim(y), rownames(y), colnames(y), attr(y, 'marker'))",
      ),
    ).resolves.toEqual(["double", "1", "2", "3", "4", "2", "2", "r1", "r2", "a", "b", "kept"]);
    await expect(
      runtime.eval(
        "set.seed(1)\na <- jitter(1:5)\nb <- jitter(1:5, amount = 0)\nc <- jitter(rep(10, 3))\nd <- jitter(rep(0, 3))\nc(all(abs(a - 1:5) <= 0.2), all(abs(b - 1:5) <= 0.08), all(abs(c - 10) <= 0.2), all(abs(d) <= 0.02))",
      ),
    ).resolves.toEqual([true, true, true, true]);
    await expect(
      runtime.eval(
        "set.seed(7)\na <- jitter(1:4)\nset.seed(7)\nb <- jitter(1:4)\nz <- jitter(1:3, factor = stop('not forced'), amount = 0.25)\nc(identical(a, b), length(z) == 3, all(abs(z - 1:3) <= 0.25))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval(
        "x <- jitter(c(1, NA, NaN, Inf, -Inf, 3), factor = 0)\nc(x[1], is.na(x[2]), is.nan(x[3]), x[4:6], typeof(jitter(integer())), length(jitter(integer())))",
      ),
    ).resolves.toEqual(["1", "TRUE", "TRUE", "Inf", "-Inf", "3", "integer", "0"]);
    await expect(runtime.eval("jitter(c(TRUE, FALSE))")).rejects.toMatchObject({
      code: "NRT3261",
    });
    await expect(runtime.eval("jitter(1:3, amount = NA_real_)")).rejects.toMatchObject({
      code: "NRT3261",
    });
    await expect(runtime.eval("jitter(c(NA, NaN, Inf))")).rejects.toMatchObject({
      code: "NRT3261",
    });
    await runtime.dispose();
  });

  it("isolates and resets random state per runtime session", async () => {
    const first = await session();
    const second = await session();
    const firstDefault = await first.eval("runif(3)");
    await expect(second.eval("runif(3)")).resolves.toEqual(firstDefault);
    await first.eval("set.seed(42)\nrunif(1)");
    await first.eval("RNGkind(sample.kind = 'Rounding')");
    await first.reset();
    await expect(first.eval("runif(3)")).resolves.toEqual(firstDefault);
    await expect(first.eval("RNGkind()")).resolves.toEqual([
      "Mersenne-Twister",
      "Inversion",
      "Rejection",
    ]);
    await first.dispose();
    await second.dispose();
  });

  it("implements browser-safe vectorized string helpers", async () => {
    const runtime = await session();
    await expect(runtime.eval('paste(c("a", "b"), 1:2, sep = "-")')).resolves.toEqual([
      "a-1",
      "b-2",
    ]);
    await expect(runtime.eval('paste0("item", 1:3)')).resolves.toEqual(["item1", "item2", "item3"]);
    await expect(runtime.eval('paste(c("a", "b"), collapse = ",")')).resolves.toBe("a,b");
    await expect(runtime.eval('paste(NA, "x", sep = "-")')).resolves.toBe("NA-x");
    await expect(runtime.eval('nchar(c("R", "茅", "😀", NA))')).resolves.toEqual([1, 1, 1, NA]);
    await expect(runtime.eval('tolower(c("AbC", NA))')).resolves.toEqual(["abc", NA]);
    await expect(runtime.eval('toupper(c("AbC", NA))')).resolves.toEqual(["ABC", NA]);
    await expect(runtime.eval('paste("a", sep = "-", sep = "/")')).rejects.toMatchObject({
      code: "NRE2102",
    });
    await runtime.dispose();
  });

  it("constructs column-major matrices and arrays with lossless dimensions", async () => {
    const runtime = await session();
    await expect(runtime.eval("m <- matrix(1:6, nrow = 2)\ndim(m)")).resolves.toEqual([2, 3]);
    await expect(runtime.evalRaw("m")).resolves.toMatchObject({
      type: "integer",
      values: new Int32Array([1, 2, 3, 4, 5, 6]),
      dim: [2, 3],
    });
    await expect(runtime.eval("matrix(1:6, nrow = 2, byrow = TRUE)")).resolves.toEqual([
      1, 4, 2, 5, 3, 6,
    ]);
    await expect(runtime.eval("a <- array(1:4, dim = c(2, 2, 1))\ndim(a)")).resolves.toEqual([
      2, 2, 1,
    ]);
    await expect(runtime.eval("nrow(m)")).resolves.toBe(2);
    await expect(runtime.eval("ncol(m)")).resolves.toBe(3);
    await expect(runtime.eval("dim(as.matrix(c(1, 2, 3)))")).resolves.toEqual([3, 1]);
    const recycled = await runtime.evalDetailed("matrix(1:3, nrow = 2, ncol = 2)");
    expect(recycled.value).toEqual([1, 2, 3, 1]);
    expect(recycled.warnings).toHaveLength(1);
    await expect(runtime.eval("matrix(1:3, nrow = 0)")).rejects.toMatchObject({ code: "NRE2115" });
    await expect(runtime.eval("array(1:3, dim = c(2, -1))")).rejects.toMatchObject({
      code: "NRT3126",
    });
    await runtime.dispose();
  });

  it("subsets and replaces arbitrary-dimensional arrays in column-major order", async () => {
    const runtime = await session();
    await runtime.eval(
      'a <- array(1:12, dim = c(2, 3, 2), dimnames = list(row = c("r1", "r2"), column = c("c1", "c2", "c3"), layer = c("z1", "z2")))',
    );
    await expect(runtime.eval("a[2, 3, 2]")).resolves.toBe(12);
    await expect(runtime.eval('a["r2", "c3", "z2"]')).resolves.toBe(12);
    await expect(runtime.eval("a[1, , 2]")).resolves.toEqual([7, 9, 11]);
    await expect(runtime.eval("names(a[1, , 2])")).resolves.toEqual(["c1", "c2", "c3"]);
    await expect(runtime.eval("a[c(2, 1), c(3, 1), 2]")).resolves.toEqual([12, 11, 8, 7]);
    await expect(runtime.evalRaw("a[c(2, 1), c(3, 1), 2]")).resolves.toMatchObject({
      dim: [2, 2],
    });
    await expect(runtime.eval("dimnames(a[c(2, 1), c(3, 1), 2])")).resolves.toEqual([
      ["r2", "r1"],
      ["c3", "c1"],
    ]);
    await expect(runtime.eval("names(dimnames(a[c(2, 1), c(3, 1), 2]))")).resolves.toEqual([
      "row",
      "column",
    ]);
    await expect(runtime.evalRaw("a[, 2, , drop = FALSE]")).resolves.toMatchObject({
      values: new Int32Array([3, 4, 9, 10]),
      dim: [2, 1, 2],
    });
    await expect(runtime.eval("dim(a[seq_len(0), , , drop = FALSE])")).resolves.toEqual([0, 3, 2]);
    await expect(runtime.eval("dimnames(a[seq_len(0), , , drop = FALSE])")).resolves.toEqual([
      null,
      ["c1", "c2", "c3"],
      ["z1", "z2"],
    ]);
    await runtime.eval(
      "blank <- array(1:4, dim = c(2, 2), dimnames = list(row = NULL, column = NULL))",
    );
    await expect(runtime.eval("dimnames(blank[, , drop = FALSE])")).resolves.toEqual([null, null]);
    await expect(runtime.eval("names(dimnames(blank[, , drop = FALSE]))")).resolves.toEqual([
      "row",
      "column",
    ]);
    await runtime.eval('one <- array(1:3, dim = 3, dimnames = list(item = c("i1", "i2", "i3")))');
    await expect(runtime.eval('one["i2"]')).resolves.toBe(2);
    await expect(runtime.evalRaw('one[c("i3", "i1")]')).resolves.toMatchObject({
      values: new Int32Array([3, 1]),
      dim: [2],
    });
    await expect(runtime.evalRaw('one["i2", drop = FALSE]')).resolves.toMatchObject({
      values: new Int32Array([2]),
      dim: [1],
    });
    await expect(runtime.eval('one[["i3"]]')).resolves.toBe(3);
    await runtime.eval('one["i2"] <- 20');
    await expect(runtime.eval('one[["i2"]]')).resolves.toBe(20);
    await expect(runtime.eval("a[[2, 3, 2]]")).resolves.toBe(12);
    await runtime.eval("a[2, c(1, 3), 2] <- c(70, 120)");
    await expect(runtime.eval("a[2, c(1, 3), 2]")).resolves.toEqual([70, 120]);
    await runtime.eval("a[[1, 2, 1]] <- 30");
    await expect(runtime.eval("a[1, 2, 1]")).resolves.toBe(30);
    await expect(runtime.eval("a[NA, 1, 1]")).resolves.toEqual([NA, NA]);
    const nanSubscript = await runtime.evalDetailed("a[NaN, 1, 1]");
    expect(nanSubscript.value).toEqual(NA);
    expect(nanSubscript.warnings).toEqual([]);
    const infiniteSubscript = await runtime.evalDetailed("a[Inf, 1, 1]");
    expect(infiniteSubscript.value).toEqual(NA);
    expect(infiniteSubscript.warnings).toMatchObject([{ code: "NRW1007" }]);
    const oversizedSubscript = await runtime.evalDetailed("a[2147483648, 1, 1]");
    expect(oversizedSubscript.value).toEqual(NA);
    expect(oversizedSubscript.warnings).toMatchObject([{ code: "NRW1007" }]);
    await expect(runtime.eval("a[1, 2]")).rejects.toMatchObject({ code: "NRT3310" });
    await expect(runtime.eval("a[3, 1, 1]")).rejects.toMatchObject({ code: "NRE2202" });
    await expect(runtime.eval('a["missing", 1, 1]')).rejects.toMatchObject({ code: "NRE2202" });
    await expect(runtime.eval("a[NA_character_, 1, 1]")).rejects.toMatchObject({
      code: "NRE2202",
    });
    await expect(runtime.eval("a[c(TRUE, TRUE, TRUE), 1, 1]")).rejects.toMatchObject({
      code: "NRE2218",
    });
    await expect(runtime.eval("a[[c(1, 2), 1, 1]]")).rejects.toMatchObject({ code: "NRE2204" });
    await expect(runtime.eval("a[[c(1, 2), 1, 1]] <- 0")).rejects.toMatchObject({
      code: "NRE2204",
    });
    await expect(runtime.eval("a[NA, 1, 1] <- 0")).rejects.toMatchObject({ code: "NRE2212" });
    await runtime.dispose();
  });

  it("indexes and replaces arbitrary-dimensional arrays by coordinate matrices", async () => {
    const runtime = await session();
    await runtime.eval(
      'a <- array(1:12, dim = c(2, 3, 2), dimnames = list(row = c("r1", "r2"), column = c("c1", "c2", "c3"), layer = c("z1", "z2")))',
    );
    await runtime.eval("index <- matrix(c(1, 1, 1, 2, 3, 2), ncol = 3, byrow = TRUE)");
    await expect(runtime.eval("a[index]")).resolves.toEqual([1, 12]);
    await expect(runtime.eval("names(a[index])")).resolves.toBeNull();
    await expect(
      runtime.eval("a[matrix(c(1, 1, 1, 0, 2, 1, 2, 3, 2), ncol = 3, byrow = TRUE)]"),
    ).resolves.toEqual([1, 12]);
    await expect(
      runtime.eval("a[matrix(c(1, 1, 1, NA, 2, 1, 2, 3, 2), ncol = 3, byrow = TRUE)]"),
    ).resolves.toEqual([1, NA, 12]);
    await expect(
      runtime.eval("a[matrix(c(1.9, 1, 1, 2, 3.9, 2), ncol = 3, byrow = TRUE)]"),
    ).resolves.toEqual([1, 12]);
    await expect(
      runtime.eval('a[matrix(c("r1", "c1", "z1", "r2", "c3", "z2"), ncol = 3, byrow = TRUE)]'),
    ).resolves.toEqual([1, 12]);
    await expect(
      runtime.eval('a[matrix(c("r1", "c1", "z1", NA, "c2", "z1"), ncol = 3, byrow = TRUE)]'),
    ).resolves.toEqual([1, NA]);
    const infinite = await runtime.evalDetailed(
      "a[matrix(c(1, 1, 1, Inf, 2, 1), ncol = 3, byrow = TRUE)]",
    );
    expect(infinite.value).toEqual([1, NA]);
    expect(infinite.warnings).toMatchObject([{ code: "NRW1007" }]);
    await runtime.eval("a[index] <- c(100, 200)");
    await expect(runtime.eval("a[c(1, 12)]")).resolves.toEqual([100, 200]);
    await expect(runtime.eval("dim(a)")).resolves.toEqual([2, 3, 2]);
    await runtime.eval("a[matrix(c(1, 1, 1, NA, 2, 1), ncol = 3, byrow = TRUE)] <- 300");
    await expect(runtime.eval("a[1]")).resolves.toBe(300);
    await expect(
      runtime.eval("a[matrix(c(1, 1, 1, 3, 2, 1), ncol = 3, byrow = TRUE)]"),
    ).rejects.toMatchObject({ code: "NRE2202" });
    await expect(
      runtime.eval("a[matrix(c(1, 1, 1, -1, 2, 1), ncol = 3, byrow = TRUE)]"),
    ).rejects.toMatchObject({ code: "NRE2219" });
    await expect(
      runtime.eval("a[matrix(c(1, 1, 2, 2), ncol = 2, byrow = TRUE)]"),
    ).rejects.toMatchObject({ code: "NRT3316" });
    await expect(
      runtime.eval('a[matrix(c("r1", "c1", "z1", "missing", "c2", "z1"), ncol = 3, byrow = TRUE)]'),
    ).rejects.toMatchObject({ code: "NRE2202" });
    await runtime.dispose();
  });

  it("indexes and replaces data-frame cells by numeric coordinate matrices", async () => {
    const runtime = await session();
    await runtime.eval("df <- data.frame(x = 1:3, y = 4:6)");
    await runtime.eval("index <- matrix(c(1, 1, 3, 2), ncol = 2, byrow = TRUE)");
    await expect(runtime.eval("df[index]")).resolves.toEqual([1, 6]);
    await expect(runtime.eval("names(df[index])")).resolves.toBeNull();
    await expect(
      runtime.eval("df[matrix(c(1, 1, 0, 2, 3, 2), ncol = 2, byrow = TRUE)]"),
    ).resolves.toEqual([1, 6]);
    await expect(
      runtime.eval("df[matrix(c(1, 1, NA, 2, 3, 2), ncol = 2, byrow = TRUE)]"),
    ).resolves.toEqual([1, NA, 6]);
    await expect(
      runtime.eval("df[matrix(c(1.9, 1, 3, 2.9), ncol = 2, byrow = TRUE)]"),
    ).resolves.toEqual([1, 6]);
    await expect(
      runtime.eval('df[matrix(c("1", "x", "3", "y"), ncol = 2, byrow = TRUE)]'),
    ).resolves.toEqual([1, 6]);
    const infinite = await runtime.evalDetailed(
      "df[matrix(c(1, 1, Inf, 2), ncol = 2, byrow = TRUE)]",
    );
    expect(infinite.value).toEqual([1, NA]);
    expect(infinite.warnings).toMatchObject([{ code: "NRW1007" }]);
    await expect(
      runtime.eval(
        'mixed <- data.frame(x = 1:3, label = c("a", "b", "c"))\nmixed[matrix(c(1, 1, 2, 2), ncol = 2, byrow = TRUE)]',
      ),
    ).resolves.toEqual(["1", "b"]);
    await expect(
      runtime.eval(
        'factored <- data.frame(x = 1:2, group = factor(c("a", "b")))\nfactored[matrix(c(1, 1, 2, 2), ncol = 2, byrow = TRUE)]',
      ),
    ).resolves.toEqual(["1", "b"]);
    await runtime.eval("df[index] <- c(100, 200)");
    await expect(runtime.eval("df[index]")).resolves.toEqual([100, 200]);
    await expect(runtime.eval("dim(df)")).resolves.toEqual([3, 2]);
    await runtime.eval("df[index] <- 300");
    await expect(runtime.eval("df[index]")).resolves.toEqual([300, 300]);
    const recycled = await runtime.evalDetailed("df[index] <- c(10, 20, 30)");
    expect(recycled.warnings).toHaveLength(1);
    await expect(runtime.eval("df[index]")).resolves.toEqual([10, 20]);
    await runtime.eval(
      'mixed <- data.frame(x = 1:3, label = c("a", "b", "c"))\nmixed[index] <- c("10", "z")',
    );
    await expect(runtime.eval("c(mixed$x, mixed$label)")).resolves.toEqual([
      "10",
      "2",
      "3",
      "a",
      "b",
      "z",
    ]);
    await expect(
      runtime.eval("df[matrix(c(1, 1, 0, 2, 3, 2), ncol = 2, byrow = TRUE)] <- c(1, 2)"),
    ).rejects.toMatchObject({ code: "NRE2220" });
    await expect(
      runtime.eval("df[matrix(c(1, 1, NA, 2), ncol = 2, byrow = TRUE)] <- 1"),
    ).rejects.toMatchObject({ code: "NRE2220" });
    await expect(
      runtime.eval('df[matrix(c("1", "x", "3", "y"), ncol = 2, byrow = TRUE)] <- c(1, 2)'),
    ).rejects.toMatchObject({ code: "NRT3317" });
    await runtime.dispose();
  });

  it("computes broader descriptive statistics with explicit missing behavior", async () => {
    const runtime = await session();
    await expect(runtime.eval("min(c(3, 1, 2))")).resolves.toBe(1);
    await expect(runtime.eval("max(c(3, 1, 2))")).resolves.toBe(3);
    await expect(runtime.eval("range(c(3, 1, 2))")).resolves.toEqual([1, 3]);
    await expect(runtime.eval("median(c(1, 4, 2, 3))")).resolves.toBe(2.5);
    await expect(runtime.eval("median(c(1, NA, 3), na.rm = TRUE)")).resolves.toBe(2);
    await expect(runtime.eval("var(c(1, 2, 3))")).resolves.toBe(1);
    await expect(runtime.eval("sd(c(1, 2, 3))")).resolves.toBe(1);
    await expect(runtime.eval("IQR(1:4)")).resolves.toBe(1.5);
    await expect(runtime.eval("IQR(c(1, NA, 4), na.rm = 1)")).resolves.toBe(1.5);
    await expect(
      runtime.eval("round(sapply(1:9, function(type) IQR(c(0, 1, 2, 10, 20), type = type)), 12)"),
    ).resolves.toEqual([9, 9, 10, 7.75, 11.75, 14.5, 9, 12.666666666667, 12.4375]);
    await expect(runtime.eval("IQR(c('1', '2'))")).resolves.toBe(0.5);
    expect(isNA(await runtime.eval("IQR(numeric())"))).toBe(true);
    await expect(runtime.eval("IQR(c(1, NA, 4))")).rejects.toMatchObject({ code: "NRT3266" });
    expect(isNA(await runtime.eval("median(c(1, NA, 3))"))).toBe(true);
    expect(isNA(await runtime.eval("var(1)"))).toBe(true);
    expect(await runtime.eval("sd(c(1, NaN, 3))")).toBeNaN();
    await runtime.dispose();
  });

  it("centers and scales usage-ranked numeric matrices with GNU R metadata rules", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- structure(matrix(1:6, 3, dimnames = list(c('r1', 'r2', 'r3'), c('a', 'b'))), marker = 'kept')\ny <- scale(x)\nc(y, attr(y, 'scaled:center'), attr(y, 'scaled:scale'))",
      ),
    ).resolves.toEqual([-1, 0, 1, -1, 0, 1, 2, 5, 1, 1]);
    await expect(
      runtime.eval(
        "c(identical(dim(y), c(3L, 2L)), identical(rownames(y), c('r1', 'r2', 'r3')), identical(colnames(y), c('a', 'b')), identical(names(attr(y, 'scaled:center')), c('a', 'b')), identical(attr(y, 'marker'), 'kept'))",
      ),
    ).resolves.toEqual([true, true, true, true, true]);
    await expect(
      runtime.eval(
        "a <- scale(matrix(1:6, 3), center = FALSE)\nb <- scale(matrix(1:6, 3), center = c(2, 5), scale = c(2, 4))\nc(a, attr(a, 'scaled:scale'), b, attr(b, 'scaled:center'), attr(b, 'scaled:scale'))",
      ),
    ).resolves.toEqual([
      1 / Math.sqrt(7),
      2 / Math.sqrt(7),
      3 / Math.sqrt(7),
      4 / Math.sqrt(38.5),
      5 / Math.sqrt(38.5),
      6 / Math.sqrt(38.5),
      Math.sqrt(7),
      Math.sqrt(38.5),
      -0.5,
      0,
      0.5,
      -0.25,
      0,
      0.25,
      2,
      5,
      2,
      4,
    ]);
    await expect(
      runtime.eval(
        "z <- scale(matrix(c(1, 1, 1, 1:3), 3, 2))\nd <- scale(data.frame(a = 1:3, b = 4:6))\nc(is.nan(z[, 1]), z[, 2], attr(z, 'scaled:center'), attr(z, 'scaled:scale'), identical(dim(d), c(3L, 2L)), identical(colnames(d), c('a', 'b')))",
      ),
    ).resolves.toEqual([1, 1, 1, -1, 0, 1, 1, 2, 0, 1, 1, 1]);
    await runtime.eval(
      "scale.custom <- function(x, center = TRUE, scale = TRUE) c('custom', center, scale)\nNULL",
    );
    await expect(
      runtime.eval("scale(structure(1:3, class = 'custom'), center = 'center', scale = 'scale')"),
    ).resolves.toEqual(["custom", "center", "scale"]);
    await expect(runtime.eval("scale(matrix(1:6, 3), center = 1:3)")).rejects.toMatchObject({
      code: "NRT3264",
    });
    await expect(runtime.eval("scale(matrix(c('a', 'b', 'c', 'd'), 2))")).rejects.toMatchObject({
      code: "NRT3264",
    });
    await runtime.dispose();
  });

  it("fits the frequency-ranked linear-model vertical slice and model accessors", async () => {
    const runtime = await session();
    await runtime.eval("fit <- lm(y ~ x, data = data.frame(x = 1:4, y = c(3, 5, 7, 9)))");
    await expect(runtime.eval("round(coef(fit), 12)")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("round(fitted(fit), 12)")).resolves.toEqual([3, 5, 7, 9]);
    await expect(runtime.eval("round(resid(fit), 12)")).resolves.toEqual([0, 0, 0, 0]);
    await expect(runtime.eval("typeof(fit$call)")).resolves.toBe("language");
    await expect(
      runtime.eval(
        "c(names(coef(fit)), class(fit), fit$rank, fit$df.residual, names(fit$qr), names(fit))",
      ),
    ).resolves.toEqual([
      "(Intercept)",
      "x",
      "lm",
      "2",
      "2",
      "qr",
      "qraux",
      "pivot",
      "tol",
      "rank",
      "coefficients",
      "residuals",
      "effects",
      "rank",
      "fitted.values",
      "assign",
      "qr",
      "df.residual",
      "xlevels",
      "call",
      "terms",
      "model",
    ]);
    await expect(
      runtime.eval("round(predict(fit, newdata = data.frame(x = c(0, 5))), 12)"),
    ).resolves.toEqual([1, 11]);
    await expect(
      runtime.eval(
        "m <- model.matrix(y ~ x + z, data.frame(y = 1:3, x = 2:4, z = c(0, 1, 0)))\nc(m, dim(m), colnames(m), attr(m, 'assign'))",
      ),
    ).resolves.toEqual([
      "1",
      "1",
      "1",
      "2",
      "3",
      "4",
      "0",
      "1",
      "0",
      "3",
      "3",
      "(Intercept)",
      "x",
      "z",
      "0",
      "1",
      "2",
    ]);
    await expect(
      runtime.eval(
        "multi <- lm(y ~ x + z, data = data.frame(y = c(2, 4, 5, 8, 10), x = 0:4, z = c(1, 0, 1, 0, 1)))\nround(c(coef(multi), fitted(multi), resid(multi)), 12)",
      ),
    ).resolves.toEqual([
      2, 2, -0.333333333333, 1.666666666667, 4, 5.666666666667, 8, 9.666666666667, 0.333333333333,
      0, -0.666666666667, 0, 0.333333333333,
    ]);
    await expect(
      runtime.eval(
        "factor_fit <- lm(y ~ g, data = data.frame(y = c(1, 2, 4, 5, 8, 9), g = factor(c('a', 'a', 'b', 'b', 'c', 'c'))))\nc(round(coef(factor_fit), 12), unlist(factor_fit$xlevels), model.matrix(factor_fit), round(predict(factor_fit, newdata = data.frame(g = factor(c('c', 'a'), levels = c('a', 'b', 'c')))), 12))",
      ),
    ).resolves.toEqual([
      "1.5",
      "3",
      "7",
      "a",
      "b",
      "c",
      "1",
      "1",
      "1",
      "1",
      "1",
      "1",
      "0",
      "0",
      "1",
      "1",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "1",
      "1",
      "8.5",
      "1.5",
    ]);
    await expect(
      runtime.eval(
        "missing_fit <- lm(y ~ x, data = data.frame(y = c(1, NA, 5, 7), x = c(0, 1, 2, NA)))\nc(round(coef(missing_fit), 12), names(fitted(missing_fit)), missing_fit$na.action, names(missing_fit$na.action), class(missing_fit$na.action))",
      ),
    ).resolves.toEqual(["1", "2", "1", "3", "2", "4", "2", "4", "omit"]);
    await expect(
      runtime.eval(
        "weighted <- lm(y ~ x, data = data.frame(y = c(1, 3, 8), x = 0:2), weights = c(1, 2, 1))\noffset_fit <- lm(y ~ x, data = data.frame(y = c(2, 5, 8), x = 1:3), offset = c(1, 1, 1))\nsingular <- lm(y ~ x + z, data = data.frame(y = 1:4, x = 1:4, z = 2 * (1:4)))\nc(round(coef(weighted), 12), round(coef(offset_fit), 12), round(coef(singular)[1:2], 12), is.na(coef(singular)[3]), singular$rank)",
      ),
    ).resolves.toEqual([0.25, 3.5, -2, 3, 0, 1, 1, 2]);
    await expect(
      runtime.eval(
        "fit_aov <- aov(y ~ g, data = data.frame(y = c(1, 2, 4, 5, 8, 9), g = factor(c('a', 'a', 'b', 'b', 'c', 'c'))))\ndirect <- local({ x <- 1:4; y <- c(2, 4, 6, 8); lm(y ~ x) })\nc(class(fit_aov), round(coef(fit_aov), 12), round(coef(direct), 12))",
      ),
    ).resolves.toEqual(["aov", "lm", "1.5", "3", "7", "0", "2"]);
    await runtime.eval(
      "coef.custom <- function(object, ...) c(custom = 42)\nfitted.custom <- function(object, ...) c(custom = 43)\npredict.custom <- function(object, ...) c(custom = 44)\nNULL",
    );
    await expect(
      runtime.eval(
        "object <- structure(list(), class = 'custom')\nc(coef(object), fitted(object), predict(object))",
      ),
    ).resolves.toEqual([42, 43, 44]);
    await runtime.dispose();
  });

  it("extracts usage-ranked model weights through the stats S3 generic", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "plain <- list(weights = c(a = 2, b = 3))\npartial <- list(weights.extra = c(4, 5))\nc(stats::weights(plain), weights(partial), is.null(weights(list(weights.a = 1, weights.b = 2))))",
      ),
    ).resolves.toEqual([2, 3, 4, 5, 1]);
    await expect(
      runtime.eval(
        "weighted <- lm(y ~ x, data.frame(y = c(1, 3, 8), x = 0:2), weights = c(1, 2, 1))\nunweighted <- lm(y ~ x, data.frame(y = c(1, 3, 8), x = 0:2))\nomitted <- lm(y ~ x, data.frame(y = c(1, NA, 8), x = 0:2), weights = c(1, 2, 3))\nc(weights(weighted), is.null(weights(unweighted)), weights(omitted))",
      ),
    ).resolves.toEqual([1, 2, 1, 1, 1, 3]);
    await expect(
      runtime.eval(
        "excluded <- structure(list(weights = c(1, 3), na.action = structure(2L, class = 'exclude')), class = 'model')\nw <- weights(excluded)\nc(w, length(w), is.na(w))",
      ),
    ).resolves.toEqual([1, NA, 3, 3, 0, 1, 0]);
    await runtime.eval(
      "weights.importance_sampling <- function(object, ..., log = TRUE, normalize = TRUE) c(object$log_weights, log, normalize)\nweights.draws <- function(object, log = FALSE, normalize = TRUE, ...) c(object$.log_weight, log, normalize)\nNULL",
    );
    await expect(
      runtime.eval(
        "psis <- structure(list(log_weights = c(-1, -2)), class = c('psis', 'importance_sampling'))\ndraws <- structure(list(.log_weight = c(-3, -4)), class = c('draws_df', 'draws'))\nc(weights(psis, log = FALSE, normalize = FALSE), weights(draws, log = TRUE, normalize = FALSE))",
      ),
    ).resolves.toEqual([-1, -2, 0, 0, -3, -4, 1, 0]);
    await expect(
      runtime.eval(
        "tracker <- FALSE\nweights(list(weights = 1:2), extra = { tracker <- TRUE; stop('forced') })\ntracker",
      ),
    ).resolves.toBe(false);
    await expect(runtime.eval("weights(1:3)")).rejects.toMatchObject({ code: "NRT3265" });
    await expect(runtime.eval("weights()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();
  });

  it("returns the usage-ranked GNU R colour catalog through true grDevices aliases", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "all <- colours()\ndistinct <- grDevices::colors(dist = TRUE)\nc(length(all), length(distinct), identical(colors, colours), is.null(names(all)))",
      ),
    ).resolves.toEqual([657, 502, 1, 1]);
    await expect(
      runtime.eval(
        "all <- colours()\ndistinct <- colors(TRUE)\nc(all[c(1, 2, 3, 153, 194, 253, 254, 259, 260, 361, 362, 657)], distinct[c(1, 100, 250, 400, 500, 502)])",
      ),
    ).resolves.toEqual([
      "white",
      "aliceblue",
      "antiquewhite",
      "gray0",
      "gray41",
      "gray100",
      "green",
      "greenyellow",
      "grey",
      "grey100",
      "honeydew",
      "yellowgreen",
      "white",
      "darkslategray2",
      "indianred1",
      "plum1",
      "yellow2",
      "yellow4",
    ]);
    await expect(
      runtime.eval(
        "c(length(colors(FALSE)), length(colors(TRUE)), length(colours(0)), length(colours(1)), length(colours(dist = TRUE)))",
      ),
    ).resolves.toEqual([657, 502, 657, 502, 502]);
    await expect(runtime.eval("colours(NA)")).rejects.toMatchObject({ code: "NRT3269" });
    await expect(runtime.eval("colours(NULL)")).rejects.toMatchObject({ code: "NRT3269" });
    await expect(runtime.eval("colours(c(TRUE, FALSE))")).rejects.toMatchObject({
      code: "NRT3269",
    });
    await expect(
      runtime.eval(
        "viridis <- grDevices::colorRampPalette(c('#440154', '#414487', '#2A788E', '#22A884', '#7AD151', '#FDE725'), space = 'Lab')\nviridis(21)",
      ),
    ).resolves.toEqual([
      "#440053",
      "#451760",
      "#45286C",
      "#443679",
      "#404486",
      "#3E5188",
      "#3A5E8A",
      "#346B8C",
      "#2A788D",
      "#2B838B",
      "#2A8F89",
      "#289B86",
      "#21A784",
      "#43B178",
      "#59BC6D",
      "#6AC65F",
      "#79D151",
      "#9FD748",
      "#C0DC3F",
      "#DFE234",
      "#FDE625",
    ]);
    await expect(
      runtime.eval(
        "c(colorRampPalette(c('red', 'blue'))(5), colorRampPalette(c('#FF000080', '#0000FF20'), alpha = TRUE)(5), colorRampPalette(c('red', 'white', 'blue'), bias = .5)(7))",
      ),
    ).resolves.toEqual([
      "#FF0000",
      "#BF003F",
      "#7F007F",
      "#3F00BF",
      "#0000FF",
      "#FF000080",
      "#BF003F68",
      "#7F007F50",
      "#3F00BF38",
      "#0000FF20",
      "#FF0000",
      "#FF3C3C",
      "#FF7878",
      "#FFB4B4",
      "#FFF0F0",
      "#9191FF",
      "#0000FF",
    ]);
    await expect(runtime.eval("length(colorRampPalette(c('red', 'blue'))(0))")).resolves.toBe(0);
    await expect(
      runtime.eval("colorRampPalette(c('red', 'blue'), interpolate = 'spline')"),
    ).rejects.toMatchObject({ code: "NRU6147" });
    await runtime.dispose();
  });

  it("computes usage-ranked vector and array outer products through lazy call dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- seq(-1, 1, length.out = 5)\nr <- sqrt(outer(x ^ 2, x ^ 2, '+'))\nround(c(dim(r), r[c(1, 2, 3, 7, 13, 25)], sum(r)), 12)",
      ),
    ).resolves.toEqual([
      5, 5, 1.414213562373, 1.11803398875, 1, 0.707106781187, 0, 1.414213562373, 23.429553284238,
    ]);
    await expect(
      runtime.eval(
        "z <- outer(c(a = 1L, b = 2L), c(u = 10L, v = 20L, w = 30L), '+')\nc(z, dim(z), dimnames(z)[[1]], dimnames(z)[[2]])",
      ),
    ).resolves.toEqual(["11", "12", "21", "22", "31", "32", "2", "3", "a", "b", "u", "v", "w"]);
    await expect(
      runtime.eval(
        "x <- array(1:4, c(2, 2), dimnames = list(row = c('r1', 'r2'), col = c('c1', 'c2')))\ny <- c(y1 = 5, y2 = 6)\nz <- outer(x, y, function(a, b, k) a + b + k, k = 100)\nc(z, dim(z), names(dimnames(z)), dimnames(z)[[3]])",
      ),
    ).resolves.toEqual([
      "106",
      "107",
      "108",
      "109",
      "107",
      "108",
      "109",
      "110",
      "2",
      "2",
      "2",
      "row",
      "col",
      "",
      "y1",
      "y2",
    ]);
    await expect(
      runtime.eval(
        "f <- function(a, b) a - b\n`%pair%` <- function(a, b) a + b\nc(outer(1:2, 10:11, 'f'), 1:2 %o% c(10, 20, 30), 1:2 %pair% 10:11)",
      ),
    ).resolves.toEqual([-9, -8, -10, -9, 10, 20, 20, 40, 30, 60, 11, 13]);
    await expect(
      runtime.eval(
        "z <- outer(NULL, 1:2, '+')\nc(dim(z), length(z), outer(1:2, 3:4, function(a, b, ignored) a + b, ignored = stop('forced')))",
      ),
    ).resolves.toEqual([0, 2, 0, 4, 5, 5, 6]);
    await expect(runtime.eval("outer(1:2, 3:4, function(a, b) 1)")).rejects.toMatchObject({
      code: "NRT3270",
    });
    await expect(runtime.eval("outer(as.raw(1), as.raw(2))")).rejects.toMatchObject({
      code: "NRT3270",
    });
    await runtime.dispose();
  });

  it("tests usage-ranked nonempty strings with primitive coercion and missingness", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "y <- c('', '65', '6599')\ninput <- ''\nc(nzchar(y), nzchar(input), nzchar('datasets'), nzchar(c('', 'x', NA)), nzchar(c('', 'x', NA), keepNA = TRUE))",
      ),
    ).resolves.toEqual([false, true, true, false, true, false, true, true, false, true, NA]);
    await expect(
      runtime.eval(
        "c(nzchar(c(FALSE, TRUE, NA), TRUE), nzchar(c(0L, 1L, NA_integer_), keepNA = TRUE), nzchar(c(NaN, NA_real_), TRUE), nzchar(as.raw(c(0, 1))), nzchar(NULL))",
      ),
    ).resolves.toEqual([true, true, NA, true, true, NA, true, NA, true, true]);
    await expect(
      runtime.eval(
        "x <- structure(c('', 'x', NA), names = c('a', 'b', 'c'), dim = c(1, 3), marker = 'drop')\nz <- nzchar(x, TRUE)\nc(z, is.null(names(z)), is.null(dim(z)), is.null(attr(z, 'marker')), nzchar(list('', NA_character_, NA_integer_, NULL), TRUE))",
      ),
    ).resolves.toEqual([false, true, NA, true, true, true, false, NA, true, true]);
    await expect(runtime.eval("nzchar(factor(c('a', 'b')))")).rejects.toMatchObject({
      code: "NRT3280",
    });
    await expect(runtime.eval("nzchar(keepNA = TRUE, x = 'x')")).rejects.toMatchObject({
      code: "NRE2142",
    });
    await expect(runtime.eval("nzchar()")).rejects.toMatchObject({ code: "NRE2142" });
    await runtime.dispose();
  });

  it("dispatches usage-ranked density methods and estimates bounded Gaussian defaults", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "density.distribution <- function(x, at, log = FALSE, ...) { payload <- if (is.list(at)) at$d else at; c(x$marker, payload, log) }\ndist <- structure(list(marker = 7), class = 'distribution')\nc(density(dist, 2), density(dist, 2, log = TRUE), density(dist, 'a'), density(dist, cbind(.2, .5, .3)), density(dist, list(d = cbind(2, 1)), ignored = stop('forced')))",
      ),
    ).resolves.toEqual([
      "7",
      "2",
      "0",
      "7",
      "2",
      "1",
      "7",
      "a",
      "FALSE",
      "7",
      "0.2",
      "0.5",
      "0.3",
      "0",
      "7",
      "2",
      "1",
      "0",
    ]);
    await expect(
      runtime.eval(
        "density.rvar <- function(x, at, ...) c(x$marker, at)\nx <- structure(list(marker = -1), class = 'rvar')\nx2 <- structure(list(marker = -2), class = 'rvar')\nc(density(x, seq(-2, 2, length.out = 5)), density(x2, seq(-2, 2, length.out = 5)), stats::density(structure(list(marker = 3), class = 'rvar'), 0))",
      ),
    ).resolves.toEqual([-1, -2, -1, 0, 1, 2, -2, -2, -1, 0, 1, 2, 3, 0]);
    await runtime.eval("d <- density(c(0, 1, 2), bw = 1, n = 5, from = -1, to = 3)");
    await expect(runtime.eval("round(c(d$x, d$y, d$bw, d$n), 12)")).resolves.toEqual([
      -1, 0, 1, 2, 3, 0.100131179815, 0.231634657145, 0.29429457648, 0.231634657145, 0.100131179815,
      1, 3,
    ]);
    await expect(runtime.eval("c(class(d), names(d), d$data.name, d$has.na)")).resolves.toEqual([
      "density",
      "x",
      "y",
      "bw",
      "n",
      "call",
      "data.name",
      "has.na",
      "x",
      "FALSE",
    ]);
    await expect(
      runtime.eval(
        "round(density.default(c(0, 2), bw = 1, weights = c(.25, .75), n = 3, from = 0, to = 2)$y, 12)",
      ),
    ).resolves.toEqual([0.140228794985, 0.241970724519, 0.312704451929]);
    await expect(runtime.eval("density(c(1, NA, 2), bw = 1)")).rejects.toMatchObject({
      code: "NRT3281",
    });
    await expect(runtime.eval("density(factor(c('a', 'b')))")).rejects.toMatchObject({
      code: "NRT3281",
    });
    await expect(runtime.eval("density(1:3, kernel = 'triangular')")).rejects.toMatchObject({
      code: "NRU6136",
    });
    await runtime.dispose();
  });

  it("decomposes usage-ranked small real matrices into owned eigen values and vectors", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "e <- eigen(matrix(c(2, 1, 1, 2), 2))\nc(round(c(e$values, abs(e$vectors)), 12), dim(e$vectors), class(e))",
      ),
    ).resolves.toEqual([
      "3",
      "1",
      "0.707106781187",
      "0.707106781187",
      "0.707106781187",
      "0.707106781187",
      "2",
      "2",
      "eigen",
    ]);
    await expect(
      runtime.eval(
        "e <- eigen(matrix(c(0, 1, -1, 0), 2), symmetric = FALSE)\nc(round(c(Re(e$values), Im(e$values), Re(e$vectors), Im(e$vectors)), 12), dim(e$vectors))",
      ),
    ).resolves.toEqual([
      0, 0, 1, -1, 0.707106781187, 0, 0.707106781187, 0, 0, -0.707106781187, 0, 0.707106781187, 2,
      2,
    ]);
    await expect(
      runtime.eval(
        "set.seed('123')\nz <- lapply(eigen(matrix(-rnorm(9), 3)), round, 3)\nc(length(z), length(z$values), dim(z$vectors))",
      ),
    ).resolves.toEqual([2, 3, 3, 3]);
    await expect(
      runtime.eval(
        "e <- eigen(matrix(c(3, 0, 0, 1, 2, 0, 1, 1, 1), 3), symmetric = FALSE)\no <- eigen(matrix(c(2, 1, 1, 2), 2), only.values = TRUE)\nc(round(e$values, 12), o$values, is.null(o$vectors), identical(class(o), 'list'))",
      ),
    ).resolves.toEqual([3, 2, 1, 3, 1, 1, 1]);
    await expect(runtime.eval("eigen(matrix(c(1, NA, 0, 1), 2))")).rejects.toMatchObject({
      code: "NRT3282",
    });
    await expect(runtime.eval("eigen(matrix(1:16, 4), symmetric = FALSE)")).rejects.toMatchObject({
      code: "NRU6137",
    });
    await runtime.dispose();
  });

  it("sums usage-ranked logical and table columns with generalized array semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "grp <- factor(c('a', 'a', 'b', 'b', 'c', 'c'))\nids <- factor(c(1, 1, 1, 2, 2, 2))\ntab_10 <- table(grp, ids)\ntab_9 <- table(ids, grp)\nc(colSums(tab_10), colSums(tab_9), names(colSums(tab_10)))",
      ),
    ).resolves.toEqual(["3", "3", "2", "2", "2", "1", "2"]);
    await expect(
      runtime.eval("za <- cbind(1:5, NA, c(1:3, NA, 5), NA)\ncolSums(!is.na(za)) > 0"),
    ).resolves.toEqual([true, false, true, false]);
    await expect(
      runtime.eval(
        "x <- array(1:24, c(2, 3, 4), dimnames = list(row = c('r1', 'r2'), col = c('c1', 'c2', 'c3'), plane = paste0('z', 1:4)))\na <- colSums(x)\nb <- colSums(x, dims = 2)\nc(a, dim(a), names(dimnames(a)), dimnames(a)[[1]], dimnames(a)[[2]], b, names(b))",
      ),
    ).resolves.toEqual([
      "3",
      "7",
      "11",
      "15",
      "19",
      "23",
      "27",
      "31",
      "35",
      "39",
      "43",
      "47",
      "3",
      "4",
      "col",
      "plane",
      "c1",
      "c2",
      "c3",
      "z1",
      "z2",
      "z3",
      "z4",
      "21",
      "57",
      "93",
      "129",
      "z1",
      "z2",
      "z3",
      "z4",
    ]);
    await expect(
      runtime.eval(
        "d <- data.frame(a = 1:2, b = c(TRUE, FALSE))\nx <- matrix(c(1, NaN, NA, 4), 2)\nz <- matrix(c(1 + 2i, NA, NaN + 1i, 4 - 2i), 2)\nc(colSums(d), is.nan(colSums(x))[1], is.na(colSums(x))[2], colSums(x, na.rm = TRUE), Re(colSums(z, na.rm = TRUE)), Im(colSums(z, na.rm = TRUE)), colSums(matrix(numeric(), 0, 3)), typeof(colSums(matrix(1:4, 2))))",
      ),
    ).resolves.toEqual([
      "3",
      "1",
      "TRUE",
      "TRUE",
      "1",
      "4",
      "1",
      "4",
      "2",
      "-2",
      "0",
      "0",
      "0",
      "double",
    ]);
    await expect(runtime.eval("colSums(1:3)")).rejects.toMatchObject({ code: "NRT3283" });
    await expect(runtime.eval("colSums(matrix(1:4, 2), dims = 0)")).rejects.toMatchObject({
      code: "NRT3283",
    });
    await expect(
      runtime.eval("colSums(data.frame(a = 1:2, b = c('x', 'y')))"),
    ).rejects.toMatchObject({ code: "NRT3283" });
    await runtime.dispose();
  });

  it("computes usage-ranked row and column means across matrices and arrays", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- matrix(1:20, 5, 4)\nc(rowMeans(x), colMeans(x), rowMeans(x[, 1:2]), colMeans(x[1:4, ]))",
      ),
    ).resolves.toEqual([
      8.5, 9.5, 10.5, 11.5, 12.5, 3, 8, 13, 18, 3.5, 4.5, 5.5, 6.5, 7.5, 2.5, 7.5, 12.5, 17.5,
    ]);
    await expect(
      runtime.eval(
        "a <- array(1:24, c(2, 3, 4), dimnames = list(c('r1', 'r2'), c('a', 'b', 'c'), c('x', 'y', 'z', 'w')))\nr1 <- rowMeans(a)\nr2 <- rowMeans(a, dims = 2)\nc1 <- colMeans(a)\nc2 <- colMeans(a, dims = 2)\nc(r1, names(r1), r2, dim(r2), unlist(dimnames(r2)), c1, dim(c1), unlist(dimnames(c1)), c2, names(c2))",
      ),
    ).resolves.toEqual([
      "12",
      "13",
      "r1",
      "r2",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "2",
      "3",
      "r1",
      "r2",
      "a",
      "b",
      "c",
      "1.5",
      "3.5",
      "5.5",
      "7.5",
      "9.5",
      "11.5",
      "13.5",
      "15.5",
      "17.5",
      "19.5",
      "21.5",
      "23.5",
      "3",
      "4",
      "a",
      "b",
      "c",
      "x",
      "y",
      "z",
      "w",
      "3.5",
      "9.5",
      "15.5",
      "21.5",
      "x",
      "y",
      "z",
      "w",
    ]);
    await expect(
      runtime.eval(
        "x <- matrix(c(1, NA, NaN, 4, 5, 6), 2)\nc(is.nan(rowMeans(x))[1], is.na(rowMeans(x))[2], rowMeans(x, na.rm = TRUE), is.na(colMeans(x))[1], is.nan(colMeans(x))[2], colMeans(x, na.rm = TRUE))",
      ),
    ).resolves.toEqual([1, 1, 3, 5, 1, 1, 1, 4, 5.5]);
    await expect(
      runtime.eval(
        "d <- data.frame(a = 1:2, b = c(TRUE, FALSE))\nc(rowMeans(d), names(rowMeans(d)), colMeans(d), names(colMeans(d)), names(rowMeans(structure(d, row.names = c('r1', 'r2')))))",
      ),
    ).resolves.toEqual(["1", "1", "1.5", "0.5", "a", "b", "r1", "r2"]);
    await expect(runtime.eval("rowMeans(1:3)")).rejects.toMatchObject({ code: "NRT3283" });
    await expect(runtime.eval("colMeans(matrix(1:4, 2), dims = 2)")).rejects.toMatchObject({
      code: "NRT3283",
    });
    await runtime.dispose();
  });

  it("computes usage-ranked weighted means with generic dispatch and missing values", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- 1:10\nw <- rep(1, 10)\na <- weighted.mean(x, w)\nw[1] <- 5\nb <- weighted.mean(x, w)\nw[1] <- 8.5\nc0 <- weighted.mean(x, w)\nw[1] <- Inf\nd <- is.nan(weighted.mean(x, w))\nw[1] <- 1\nw[10] <- Inf\ne <- is.nan(weighted.mean(x, w))\nw <- rep(0, 10)\nf <- is.nan(weighted.mean(x, w))\nc(a, b, c0, d, e, f)",
      ),
    ).resolves.toEqual([5.5, 4.214285714285714, 3.5714285714285716, 1, 1, 1]);
    await expect(
      runtime.eval(
        "z <- weighted.mean(c(1+2i, 3+4i), c(1, 3))\nc(weighted.mean(c(1, NA, 3), c(1, 2, 3), na.rm = TRUE), weighted.mean(c(NA, 2), c(0, 1)), weighted.mean(c(NA, 2), c(NA, 1), na.rm = TRUE), is.na(weighted.mean(c(1, 2), c(NA, 1), na.rm = TRUE)), is.na(weighted.mean(c(1, 2), c(NaN, 1), na.rm = TRUE)) && !is.nan(weighted.mean(c(1, 2), c(NaN, 1), na.rm = TRUE)), z == 2.5+3.5i, typeof(z) == 'complex')",
      ),
    ).resolves.toEqual([2.5, 2, 2, 1, 1, 1, 1]);
    await expect(
      runtime.eval(
        "weighted.mean.foo <- function(x, w, ...) 42\nc(stats::weighted.mean(c(a = 1, b = 3)), stats:::weighted.mean.default(1:3, 1:3), weighted.mean(structure(1:2, class = 'foo'), 1:2), is.null(names(weighted.mean(c(a = 1, b = 3)))))",
      ),
    ).resolves.toEqual([2, 2.3333333333333335, 42, 1]);
    await expect(runtime.eval("weighted.mean(1:2, 1:3)")).rejects.toMatchObject({
      code: "NRT3306",
    });
    await runtime.dispose();
  });

  it("computes usage-ranked median absolute deviations with documented selectors", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(stats::mad(1:10), mad(1:2))")).resolves.toEqual([
      3.7064999999999997, 0.7413,
    ]);
    await expect(
      runtime.eval(
        "x <- c(1, 2, 3, 5, 7, 8)\nc(mad(x, constant = 1), mad(x, constant = 1, low = TRUE), mad(x, constant = 1, high = TRUE), mad(1:3, center = 0, constant = 2))",
      ),
    ).resolves.toEqual([2.5, 2, 3, 4]);
    await expect(
      runtime.eval(
        "c(is.na(mad(c(1, NA, 3))), mad(c(1, NA, 3), na.rm = TRUE), is.na(mad(numeric())), is.null(names(mad(c(a = 1, b = 3)))), inherits(try(mad(1:2, low = TRUE, high = TRUE), silent = TRUE), 'try-error'))",
      ),
    ).resolves.toEqual([1, 1.4826, 1, 1, 1]);
    await runtime.dispose();
  });

  it("generates usage-ranked central and non-central beta random values", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "set.seed(124)\nN <- 50; S <- 100; a0 <- 3; b0 <- 2\np <- stats::rbeta(1, a0, b0)\na <- a0 + 10; b <- b0 + N * 10 - 10\nfake_posterior <- as.matrix(rbeta(S, a, b))\nc(p >= 0, p <= 1, dim(fake_posterior), all(fake_posterior >= 0), all(fake_posterior <= 1), !any(is.na(fake_posterior)))",
      ),
    ).resolves.toEqual([1, 1, 100, 1, 1, 1, 1]);
    await expect(
      runtime.eval(
        "set.seed(17)\na <- rbeta(8, c(1, 2), c(3, 4, 5), ncp = c(0, 2))\nset.seed(17)\nb <- rbeta(8, c(1, 2), c(3, 4, 5), ncp = c(0, 2))\nset.seed(99)\nz <- rbeta(4000, 3, 2)\nc(identical(a, b), all(a >= 0), all(a <= 1), length(a), length(rbeta(c(7, 8), 2, 3)), length(rbeta(2.9, 2, 3)), length(rbeta(numeric(), 2, 3)), is.null(names(rbeta(setNames(1, 'n'), setNames(2, 'a'), 3))), abs(mean(z) - 0.6) < 0.03, abs(var(z) - 0.04) < 0.01)",
      ),
    ).resolves.toEqual([1, 1, 1, 8, 2, 2, 0, 1, 1, 1]);
    await expect(
      runtime.eval(
        "set.seed(1)\nx <- rbeta(7, c(0, 0, 2, Inf, Inf, 1, 0), c(0, 2, 0, 2, Inf, Inf, Inf))\nc(x[2:7], x[1] %in% c(0, 1))",
      ),
    ).resolves.toEqual([0, 1, 1, 0.5, 0, 0, 1]);
    const invalid = await runtime.evalDetailed(
      "suppressWarnings(c(is.nan(rbeta(1, -1, 2)), is.nan(rbeta(1, NA, 2)), is.na(rbeta(1, numeric(), 2)) && !is.nan(rbeta(1, numeric(), 2))))",
    );
    expect(invalid.value).toEqual([true, true, true]);
    await expect(runtime.eval("rbeta(-1, 2, 3)")).rejects.toMatchObject({ code: "NRT3308" });
    await expect(runtime.eval("rbeta(1, 2 + 0i, 3)")).rejects.toMatchObject({
      code: "NRT3309",
    });
    await runtime.dispose();
  });

  it("computes usage-ranked binomial densities and log likelihoods", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("round(stats::dbinom(4, size = 10, prob = c(.1, .3, .8), log = TRUE), 12)"),
    ).resolves.toEqual([-4.495395935206, -1.608833350219, -5.202094149144]);
    await expect(
      runtime.eval(
        "x <- structure(0:3, dim = c(2, 2), dimnames = list(c('a', 'b'), c('c', 'd')), marker = 'kept')\ny <- dbinom(x, c(3, 3), c(.5, .5, .5))\nc(round(y, 12), dim(y), unlist(dimnames(y)), attr(y, 'marker'), abs(dbinom(500000, 1000000, .5, log = TRUE) + 7.13354688162686) < 2e-9, dbinom(c(-1, 11), 10, .3))",
      ),
    ).resolves.toEqual([
      "0.125",
      "0.375",
      "0.375",
      "0.125",
      "2",
      "2",
      "a",
      "b",
      "c",
      "d",
      "kept",
      "TRUE",
      "0",
      "0",
    ]);
    await expect(
      runtime.eval(
        "suppressWarnings({ y <- dbinom(c(NA, NaN, 1.5, 1), c(3, 3, 3, -1), .5); c(is.na(y[1]) && !is.nan(y[1]), is.nan(y[2]), y[3] == 0, is.nan(y[4]), length(dbinom(numeric(), 3, .5)), length(dbinom(1, numeric(), .5)), abs(dbinom(1, 3, .5, log = NA) - log(.375)) < 1e-14, dbinom(0, Inf, 0), dbinom(1, Inf, .5)) })",
      ),
    ).resolves.toEqual([1, 1, 1, 1, 0, 0, 1, 1, 0]);
    const nonInteger = await runtime.evalDetailed("dbinom(1.5, 3, .5)");
    expect(nonInteger.value).toBe(0);
    expect(nonInteger.warnings).toEqual([{ code: "NRW1003", message: "non-integer x = 1.500000" }]);
    const invalid = await runtime.evalDetailed("dbinom(1, c(-1, 1.5), .5)");
    expect(invalid.value).toEqual([Number.NaN, Number.NaN]);
    expect(invalid.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced" }]);
    await expect(runtime.eval("dbinom(1, 3, list(.5))")).rejects.toMatchObject({
      code: "NRT3304",
    });
    await runtime.dispose();
  });

  it("creates usage-ranked zero matrices or vectors from requested extents", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "b <- base::mat.or.vec(10, 3)\nc(typeof(b), dim(b), length(b), sum(b), is.null(dim(b)))",
      ),
    ).resolves.toEqual(["double", "10", "3", "30", "0", "FALSE"]);
    await expect(
      runtime.eval(
        "a <- mat.or.vec(3, 1)\nb <- mat.or.vec(3, 1.1)\nz <- mat.or.vec(3, 0)\nc(a, length(a), is.null(dim(a)), b, dim(b), z, dim(z), length(mat.or.vec(0, 1)), is.null(dim(mat.or.vec(0, 1))))",
      ),
    ).resolves.toEqual([0, 0, 0, 3, 1, 0, 0, 0, 3, 1, 3, 0, 0, 1]);
    await expect(
      runtime.eval(
        "x <- mat.or.vec(c(nr = 2, ignored = 9), c(nc = 2))\ny <- mat.or.vec('3', '1')\nc(x, dim(x), is.null(names(x)), y, is.null(attributes(y)), dim(mat.or.vec(2.9, .9)))",
      ),
    ).resolves.toEqual([0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 1, 2, 0]);
    await expect(runtime.eval("mat.or.vec(2, c(1, 2))")).rejects.toMatchObject({
      code: "NRT3319",
    });
    await expect(runtime.eval("mat.or.vec(c(2, 9), 1)")).rejects.toMatchObject({
      code: "NRT3320",
    });
    await expect(runtime.eval("mat.or.vec('2', 2)")).rejects.toMatchObject({
      code: "NRT3321",
    });
    await runtime.dispose();
  });

  it("generates usage-ranked primitive integer sequences", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "n <- 3L\nc(base::seq.int(n), seq.int(n - 1L), seq.int(n - 1L), typeof(seq.int(n)))",
      ),
    ).resolves.toEqual(["1", "2", "3", "1", "2", "1", "2", "integer"]);
    await expect(
      runtime.eval(
        "c(seq.int(0), seq.int(-2), seq.int(c(10, 20, 30)), seq.int('5'), length(seq.int(NULL)))",
      ),
    ).resolves.toEqual([1, 0, 1, 0, -1, -2, 1, 2, 3, 1, 0]);
    await expect(
      runtime.eval(
        "c(seq.int(1, 2, by = .3), seq.int(2, 5, length.out = 3.1), seq.int(length.out = 4), seq.int(along.with = letters[1:3]))",
      ),
    ).resolves.toEqual([1, 1.3, 1.6, 1.9, 2, 3, 4, 5, 1, 2, 3, 4, 1, 2, 3]);
    await expect(
      runtime.eval(
        "seq.foo <- function(from, ..., marker = 'default') c('method', unclass(from), marker, list(...)[['extra']])\nseq.int(structure(3, class = 'foo'), marker = 'ok', extra = 7)",
      ),
    ).resolves.toEqual(["method", "3", "ok", "7"]);
    await expect(runtime.eval("seq.int(1, 3, by = 0)")).rejects.toMatchObject({
      code: "NRE2160",
    });
    await expect(runtime.eval("seq.int(Inf, 3)")).rejects.toMatchObject({
      code: "NRT3322",
    });
    await expect(runtime.eval("seq.int(1, 3, by = 1, length.out = 2)")).rejects.toMatchObject({
      code: "NRE2160",
    });
    await runtime.dispose();
  });

  it("dispatches usage-ranked methods coercions through a session registry", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "as.IDate <- function(x) structure(as.integer(as.Date(x)), class = c('IDate', 'Date'))\nas.ITime <- function(x) structure(ifelse(x == '10:45', 38700L, NA_integer_), class = 'ITime')\nmethods::setAs('character', 'IDate', as.IDate)\nsetAs('character', 'ITime', as.ITime)\nc(identical(as.IDate('2001-01-01'), methods::as('2001-01-01', 'IDate')), identical(as.ITime('10:45'), methods::as('10:45', 'ITime')))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(
      runtime.eval(
        "a <- methods::as(1:3, 'character')\nb <- methods::as(c('1', '2'), 'integer')\nd <- as.Date('2001-01-01')\nc(a, typeof(a), b, typeof(b), identical(methods::as(d, 'Date'), d), identical(methods::as(1:3, 'numeric'), 1:3))",
      ),
    ).resolves.toEqual(["1", "2", "3", "character", "1", "2", "integer", "TRUE", "TRUE"]);
    await expect(
      runtime.eval(
        "setClass('parent')\nsetClass('child', contains = 'parent')\nsetAs('parent', 'label', function(from) structure(unclass(from), class = 'label'))\nx <- structure(c(a = 4), class = 'child')\ny <- methods::as(x, 'label')\nc(class(y), unclass(y), names(y))",
      ),
    ).resolves.toEqual(["label", "4", "a"]);
    const registration = await runtime.evalDetailed(
      "setAs('numeric', 'score', function(from) structure(from, class = 'score'))",
    );
    expect(registration.value).toBeNull();
    expect(registration.visible).toBe(false);
    await expect(runtime.eval("methods::as(1, 'notRegistered')")).rejects.toMatchObject({
      code: "NRE2161",
    });
    await expect(runtime.eval("setAs('numeric', 'score', 1)")).rejects.toMatchObject({
      code: "NRT3323",
    });
    await runtime.dispose();
  });

  it("constructs usage-ranked legacy S4 representations", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "r <- methods::representation(x = 'character', dt = 'data.table')\nc(names(r), unlist(r), length(r))",
      ),
    ).resolves.toEqual(["x", "dt", "character", "data.table", "2"]);
    await expect(
      runtime.eval(
        "a <- representation('track', smooth = 'numeric')\nb <- representation('numeric', 'character')\nc(length(a), names(a), unlist(a), is.null(attributes(representation())), is.null(names(b)))",
      ),
    ).resolves.toEqual(["2", "", "smooth", "track", "numeric", "TRUE", "TRUE"]);
    await expect(
      runtime.eval(
        "setClass('Something', representation(x = 'character', dt = 'data.table'))\ndt <- structure(data.frame(a = 1:2), class = c('data.table', 'data.frame'))\nx <- new('Something', x = 'check', dt = dt)\nc(class(x), x$x, class(x$dt))",
      ),
    ).resolves.toEqual(["Something", "check", "data.table", "data.frame"]);
    await expect(
      runtime.eval(
        "r <- representation('', slot = NA_character_, `slot name` = 'numeric')\nc(length(r), is.na(r$slot), r[[1]], names(r))",
      ),
    ).resolves.toEqual(["3", "TRUE", "", "", "slot", "slot name"]);
    for (const [code, expectedCode] of [
      ["representation(x = 'numeric', x = 'character')", "NRT3327"],
      ["representation('numeric', 'numeric')", "NRT3327"],
      ["representation(x = c('numeric', 'character'))", "NRT3327"],
      ["representation(x = 1)", "NRT3327"],
      ["representation(x = factor('numeric'))", "NRT3327"],
      ["representation(x = )", "NRE2103"],
    ] as const) {
      await expect(runtime.eval(code)).rejects.toMatchObject({ code: expectedCode });
    }
    await runtime.dispose();
  });

  it("extracts usage-ranked deterministic C-locale weekday names", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "idate <- structure(as.integer(as.Date(c('2001-01-01', '2001-01-02'))), class = c('IDate', 'Date'))\nc(weekdays(idate), weekdays(idate))",
      ),
    ).resolves.toEqual(["Monday", "Tuesday", "Monday", "Tuesday"]);
    const named = await runtime.evalDetailed(
      "weekdays(setNames(as.Date(c('2001-01-01', '2001-01-02')), c('a', 'b')), abbreviate = c(TRUE, FALSE))",
    );
    expect(named.value).toEqual(["Mon", "Tuesday"]);
    expect(named.raw).toMatchObject({ type: "character", names: ["a", "b"] });
    await expect(
      runtime.eval(
        "c(weekdays(as.POSIXct(c('2001-01-01 00:00:00', '2001-01-02 23:30:00'), tz = 'UTC')), weekdays(as.POSIXlt(as.POSIXct('2001-01-03 12:00:00', tz = 'UTC'))))",
      ),
    ).resolves.toEqual(["Monday", "Tuesday", "Wednesday"]);
    await expect(
      runtime.eval(
        "weekdays.foo <- function(x, abbreviate = FALSE) c('method', unclass(x), abbreviate)\nweekdays(structure(3, class = 'foo'), TRUE)",
      ),
    ).resolves.toEqual(["method", "3", "TRUE"]);
    await expect(runtime.eval("weekdays(1)")).rejects.toMatchObject({ code: "NRE2216" });
    await expect(runtime.eval("weekdays(as.Date('2001-01-01'), logical())")).rejects.toMatchObject({
      code: "NRT3324",
    });
    await runtime.dispose();
  });

  it("finds usage-ranked first duplicate positions with package-method dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(anyDuplicated(c(1L, 2L, 1L, 2L)), anyDuplicated(1:4), anyDuplicated(c(1L, 1L, 2L, 2L, 3L)), anyDuplicated(c(1L, 1L, 2L, 2L, 3L), fromLast = TRUE))",
      ),
    ).resolves.toEqual([3, 0, 2, 3]);
    await expect(
      runtime.eval(
        "c(anyDuplicated(c(NA_real_, NaN, NA_real_, NaN)), anyDuplicated(c(1L, 2L, 1L), incomparables = 1L), anyDuplicated(factor(c('a', 'b', 'a'))), anyDuplicated(list(1, 'x', 1)), anyDuplicated(list(1, 1), incomparables = 1), anyDuplicated(list(list(1), list(1)), incomparables = list(1)), anyDuplicated(data.frame(a = c(1, 2, 1), b = c('x', 'y', 'x'))))",
      ),
    ).resolves.toEqual([3, 0, 3, 3, 0, 2, 3]);
    await expect(
      runtime.eval(
        "anyDuplicated.data.table <- function(x, incomparables = FALSE, fromLast = FALSE, by = seq_along(x), ...) anyDuplicated(paste(x[[by[[1]]]], x[[by[[2]]]]), incomparables = incomparables, fromLast = fromLast)\nDT <- structure(data.frame(A = c(1, 1, 2, 2, 3), B = c(1, 2, 1, 1, 2), C = c('a', 'b', 'a', 'b', 'a')), class = c('data.table', 'data.frame'))\nanyDuplicated(DT, by = c('A', 'B'))",
      ),
    ).resolves.toBe(4);
    await expect(runtime.eval("anyDuplicated(c(1, 1), fromLast = NA)")).rejects.toMatchObject({
      code: "NRT3325",
    });
    await runtime.dispose();
  });

  it("repeats usage-ranked vectors with rep.int semantics", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("an <- function(n, len) c(seq.int(n), rep.int(n, len - n))\nan(3, 6)"),
    ).resolves.toEqual([1, 2, 3, 3, 3, 3]);
    await expect(
      runtime.eval(
        "c(rep.int(1:3, 2), rep.int(1:3, c(2, 1, 0)), rep.int(1:3, 2.9), rep.int(1:2, c('1', '2')))",
      ),
    ).resolves.toEqual([1, 2, 3, 1, 2, 3, 1, 1, 2, 1, 2, 3, 1, 2, 3, 1, 2, 2]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 1L, b = 2L), marker = 'drop')\nf <- structure(factor(c('b', 'a')), names = c('x', 'y'), marker = 'drop')\nl <- structure(list(a = 1, b = 'x'), marker = 'drop')\ny <- rep.int(f, 2)\nc(rep.int(x, 2), is.null(attributes(rep.int(x, 2))), as.character(y), class(y), levels(y), is.null(names(y)), unlist(rep.int(l, c(2, 1))), is.null(attributes(rep.int(l, c(2, 1)))))",
      ),
    ).resolves.toEqual([
      "1",
      "2",
      "1",
      "2",
      "TRUE",
      "b",
      "a",
      "b",
      "a",
      "factor",
      "a",
      "b",
      "TRUE",
      "1",
      "1",
      "x",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        "e <- rep.int(expression(a + b, 1L), c(2, 1))\nc(length(e), identical(e, expression(a + b, a + b, 1L)), as.integer(rep.int(as.raw(c(1, 255)), c(1, 2))))",
      ),
    ).resolves.toEqual([3, 1, 1, 255, 255]);
    await expect(
      runtime.eval(
        "assign('rep.int.foo', function(x, times) c('method', unclass(x), times), envir = globalenv())\nrep.int(structure(7, class = 'foo'), 3)",
      ),
    ).resolves.toEqual(["method", "7", "3"]);
    for (const code of [
      "rep.int(NULL, 2)",
      "rep.int(pairlist(a = 1), 2)",
      "rep.int(1:2, integer())",
      "rep.int(1:3, c(1, 2))",
      "rep.int(1:2, -1)",
      "rep.int(1:2, as.raw(2))",
    ]) {
      await expect(runtime.eval(code)).rejects.toMatchObject({ code: "NRT3326" });
    }
    await expect(runtime.eval("rep.int(1, 1e12)")).rejects.toMatchObject({ code: "NRL4002" });
    await runtime.dispose();
  });

  it("computes Student-t probabilities and model confidence intervals from owned QR data", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("round(qt(c(.001, .025, .5, .975, .999), c(2, 5, 10, 30, Inf)), 12)"),
    ).resolves.toEqual([-22.32712477012, -2.570581835636, 0, 2.042272456301, 3.090232306168]);
    await expect(
      runtime.eval("round(pt(c(-Inf, -3, 0, 3, Inf), c(1, 2, 5, 10, 30)), 12)"),
    ).resolves.toEqual([0, 0.047732983133, 0.5, 0.993328172489, 1]);
    await expect(
      runtime.eval(
        "round(c(qt(.025, 10, lower.tail = FALSE), qt(log(.025), 10, log.p = TRUE), pt(2, 10, lower.tail = FALSE), pt(2, 10, log.p = TRUE)), 12)",
      ),
    ).resolves.toEqual([2.228138851986, -2.228138851986, 0.036694017385, -0.037384178696]);
    await expect(
      runtime.eval(
        "x <- qt(structure(c(.25, .75), names = c('a', 'b'), marker = 'x'), 10)\nc(round(x, 12), names(x), attr(x, 'marker'))",
      ),
    ).resolves.toEqual(["-0.699812061312", "0.699812061312", "a", "b", "x"]);

    await runtime.eval("fit <- lm(y ~ x, data.frame(x = 1:5, y = c(2, 4, 5, 8, 10)))");
    await expect(runtime.eval("round(c(vcov(fit), confint(fit)), 12)")).resolves.toEqual([
      0.293333333333, -0.08, -0.08, 0.026666666667, -1.923621066988, 1.48030869455, 1.523621066988,
      2.51969130545,
    ]);
    await expect(
      runtime.eval(
        "ci <- confint(fit, parm = c('x', '(Intercept)'), level = .9)\nc(round(ci, 12), rownames(ci), colnames(ci), dim(ci), df.residual(fit))",
      ),
    ).resolves.toEqual([
      "1.615697360361",
      "-1.474587661626",
      "2.384302639639",
      "1.074587661626",
      "x",
      "(Intercept)",
      "5 %",
      "95 %",
      "2",
      "2",
      "3",
    ]);
    await expect(
      runtime.eval(
        "weighted <- lm(y ~ x, data.frame(y = c(1, 3, 8), x = 0:2), weights = c(1, 2, 1))\nround(c(vcov(weighted), confint(weighted)), 12)",
      ),
    ).resolves.toEqual([
      1.6875, -1.125, -1.125, 1.125, -16.25584413082, -9.976965298141, 16.75584413082,
      16.976965298141,
    ]);
    await expect(
      runtime.eval(
        "singular <- lm(y ~ x + z, data.frame(y = 1:4, x = 1:4, z = 2 * (1:4)))\nc(round(vcov(singular, complete = FALSE), 12), is.na(vcov(singular)), is.na(confint(singular)))",
      ),
    ).resolves.toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1]);
    await runtime.eval(
      "vcov.custom <- function(object, ...) 42\nconfint.custom <- function(object, ...) 43\ndf.residual.custom <- function(object, ...) 44\nNULL",
    );
    await expect(
      runtime.eval(
        "object <- structure(list(), class = 'custom')\nc(vcov(object), confint(object), df.residual(object))",
      ),
    ).resolves.toEqual([42, 43, 44]);
    await expect(runtime.eval("qt(.5, 3, ncp = 1)")).rejects.toMatchObject({ code: "NRU6131" });
    await runtime.dispose();
  });

  it("clusters frequency-ranked numeric data through the documented kmeans algorithms", async () => {
    const runtime = await session();
    await runtime.eval(
      "x <- structure(matrix(c(0, 0, 0, 1, 1, 0, 9, 9, 10, 9, 9, 10), ncol = 2, byrow = TRUE), dimnames = list(paste0('r', 1:6), c('a', 'b')))\ninitial <- matrix(c(0, 0, 10, 10), ncol = 2, byrow = TRUE)",
    );
    await expect(
      runtime.eval(
        "fit <- kmeans(x, initial)\nround(c(fit$cluster, fit$centers, fit$totss, fit$withinss, fit$tot.withinss, fit$betweenss, fit$size, fit$iter, fit$ifault), 12)",
      ),
    ).resolves.toEqual([
      1, 1, 1, 2, 2, 2, 0.333333333333, 9.333333333333, 0.333333333333, 9.333333333333,
      245.666666666667, 1.333333333333, 1.333333333333, 2.666666666667, 243, 3, 3, 1, 0,
    ]);
    await expect(
      runtime.eval(
        "fits <- lapply(c('Hartigan-Wong', 'Lloyd', 'Forgy', 'MacQueen'), function(a) kmeans(x, initial, algorithm = a))\nc(sapply(fits, function(z) z$iter), round(sapply(fits, function(z) z$tot.withinss), 12), sapply(fits, function(z) is.null(z$ifault)))",
      ),
    ).resolves.toEqual([
      1, 2, 2, 1, 2.666666666667, 2.666666666667, 2.666666666667, 2.666666666667, 0, 1, 1, 1,
    ]);
    await expect(
      runtime.eval(
        "v <- kmeans(setNames(1:6, c('a', 'b', 'c', 'd', 'e', 'f')), matrix(c(1, 5), ncol = 1))\nc(v$cluster, v$centers, v$totss, v$withinss, v$tot.withinss, v$betweenss, v$size, v$iter, names(v$cluster), rownames(v$centers), is.null(colnames(v$centers)), class(v))",
      ),
    ).resolves.toEqual([
      "1",
      "1",
      "1",
      "2",
      "2",
      "2",
      "2",
      "5",
      "17.5",
      "2",
      "2",
      "4",
      "13.5",
      "3",
      "3",
      "1",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "1",
      "2",
      "TRUE",
      "kmeans",
    ]);
    await expect(
      runtime.eval(
        "set.seed(123)\na <- kmeans(x, 2, nstart = 5)\nset.seed(123)\nb <- kmeans(x, 2, nstart = 5)\nc(identical(a, b), sort(a$size), round(a$tot.withinss, 12), length(unique(a$cluster)))",
      ),
    ).resolves.toEqual([1, 3, 3, 2.666666666667, 2]);
    await expect(
      runtime.eval(
        "d <- kmeans(data.frame(a = c(0, 1, 9, 10), b = c(0, 1, 9, 10)), matrix(c(0, 0, 10, 10), 2, byrow = TRUE))\ne <- kmeans(matrix(numeric(), 2, 0), 1)\nc(round(d$centers, 12), d$size, e$cluster, length(e$centers), e$totss, e$withinss)",
      ),
    ).resolves.toEqual([0.5, 9.5, 0.5, 9.5, 2, 2, 1, 1, 0, 0, 0]);
    const traced = await runtime.evalDetailed(
      "kmeans(x, initial, algorithm = 'Hartigan-Wong', trace = TRUE)$iter",
    );
    expect(traced.value).toBe(1);
    expect(traced.output.map((event) => event.text).join("")).toContain("kmeans iteration 1");
    const limited = await runtime.evalDetailed(
      "kmeans(matrix(c(0,0,1,0,2,0,3,0,4,0,5,0), byrow = TRUE, ncol = 2), matrix(c(0,0,5,0), 2, byrow = TRUE), iter.max = 1, algorithm = 'Lloyd')$ifault",
    );
    expect(limited.value).toBe(2);
    expect(limited.warnings).toEqual([
      { code: "NRW1102", message: "did not converge in 1 iteration" },
    ]);
    await expect(
      runtime.eval("kmeans(x, rbind(initial[1, ], initial[1, ]))"),
    ).rejects.toMatchObject({ code: "NRT3268" });
    await expect(runtime.eval("kmeans(matrix(c(1, NA, 2, 3), 2), 2)")).rejects.toMatchObject({
      code: "NRT3268",
    });
    await expect(runtime.eval("kmeans(x, initial, algorithm = 'lloyd')")).rejects.toMatchObject({
      code: "NRE2139",
    });
    await expect(runtime.eval("kmeans(x, initial, iter.max = 0)")).rejects.toMatchObject({
      code: "NRT3268",
    });
    await runtime.dispose();
  });

  it("computes frequency-ranked circular, open, and filtering convolutions", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "c(convolve(1:3, c(10, 20, 30)), convolve(1:3, c(10, 20, 30), conj = FALSE), convolve(1:3, c(10, 20), type = 'open'), convolve(1:3, c(10, 20), conj = FALSE, type = 'open'), convolve(1:5, c(10, 20, 30), type = 'filter'), round(convolve(1:5, c(10, 20, 30), conj = FALSE, type = 'filter'), 12))",
      ),
    ).resolves.toEqual([
      140, 110, 110, 130, 130, 100, 20, 50, 80, 30, 60, 10, 40, 70, 140, 200, 260, 10, 40, 100,
    ]);
    await expect(
      runtime.eval(
        "z <- convolve(c(1 + 2i, 3 - 1i), c(2 - 1i, 4 + 3i), type = 'open')\nw <- convolve(c(1 + 2i, 3 - 1i), c(2 - 1i, 4 + 3i), conj = FALSE)\nc(Re(z), Im(z), Re(w), Im(w))",
      ),
    ).resolves.toEqual([10, 9, 7, 5, -8, 1, 19, 3, 8, 6]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 1, b = 2), marker = 'x')\na <- convolve(x, c(3, 4))\nb <- convolve(x, c(3, 4), type = 'open')\nm <- convolve(matrix(1:4, 2), matrix(5:8, 2))\nl <- convolve(c(TRUE, FALSE), c(TRUE, TRUE))\nc(a, names(a), attr(a, 'marker'), b, names(b), m, dim(m), typeof(l), Re(l), Im(l))",
      ),
    ).resolves.toEqual([
      "11",
      "10",
      "a",
      "b",
      "x",
      "4",
      "11",
      "6",
      "",
      "a",
      "b",
      "70",
      "68",
      "62",
      "60",
      "2",
      "2",
      "complex",
      "1",
      "1",
      "0",
      "0",
    ]);
    await expect(
      runtime.eval(
        "a <- convolve(c(1, NA, 3), c(1, 2), type = 'filter')\nb <- convolve(c(1, NaN), c(2, 3))\nc(is.na(a), is.nan(b))",
      ),
    ).resolves.toEqual([true, true, true, true]);
    const factor = await runtime.evalDetailed(
      "z <- convolve(factor(c('a', 'b')), 1:2)\nc(typeof(z), is.na(z))",
    );
    expect(factor.value).toEqual(["complex", "TRUE", "TRUE"]);
    expect(factor.warnings).toEqual([
      { code: "NRW1103", message: "'*' not meaningful for factors" },
    ]);
    await expect(
      runtime.eval(
        "a <- convolve(1:128, rep(1, 128))\nb <- convolve(1:127, rep(1, 127))\nc(length(a), all(abs(a - sum(1:128)) < 1e-8), length(b), all(abs(b - sum(1:127)) < 1e-8))",
      ),
    ).resolves.toEqual([128, 1, 127, 1]);
    await expect(
      runtime.eval(
        "z <- convolve((1:65) + 1i, rep(1 + 0i, 65))\nc(all(abs(Re(z) - sum(1:65)) < 1e-8), all(abs(Im(z) - 65) < 1e-8))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(runtime.eval("convolve(1:2, 1:3)")).rejects.toMatchObject({ code: "NRT3269" });
    await expect(
      runtime.eval("convolve(numeric(), numeric(), type = 'open')"),
    ).rejects.toMatchObject({ code: "NRT3269" });
    await expect(runtime.eval("convolve(1:2, 3:4, type = 'bad')")).rejects.toMatchObject({
      code: "NRT3269",
    });
    await expect(runtime.eval("convolve(1:2, 3:4, conj = NA)")).rejects.toMatchObject({
      code: "NRT3269",
    });
    await runtime.dispose();
  });

  it("constructs and formats usage-ranked hexadecimal integer modes", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "x <- as.hexmode(structure(c(a = 0L, b = 10L, c = 255L, d = -1L, e = NA_integer_), tag = 'kept'))\nc(typeof(x), class(x), unclass(x), as.character(x), format(x), names(format(x)), attr(x, 'tag'))",
      ),
    ).resolves.toEqual([
      "integer",
      "hexmode",
      "0",
      "10",
      "255",
      "-1",
      NA,
      "0",
      "a",
      "ff",
      "ffffffff",
      NA,
      "00000000",
      "0000000a",
      "000000ff",
      "ffffffff",
      NA,
      "a",
      "b",
      "c",
      "d",
      "e",
      "kept",
    ]);
    await expect(
      runtime.eval(
        "a <- as.hexmode(c(16, NA, NaN, -16))\nb <- as.hexmode(c('0x10', ' +ff', '7fffffff'))\nc(as.integer(a), as.character(a), as.integer(b), format(b, width = 8, upper.case = TRUE))",
      ),
    ).resolves.toEqual([
      "16",
      NA,
      NA,
      "-16",
      "10",
      NA,
      NA,
      "fffffff0",
      "16",
      "255",
      "2147483647",
      "00000010",
      "000000FF",
      "7FFFFFFF",
    ]);
    await expect(
      runtime.eval(
        "a <- !as.hexmode(c(0L, 10L, 255L, NA_integer_))\nb <- as.hexmode(c(15L, 16L, NA_integer_)) & c(3L, 1L)\nd <- c(8L, 16L) | as.hexmode(c(3L, 1L))\nc(as.integer(a), as.integer(b), as.integer(d), class(a), class(b), class(d))",
      ),
    ).resolves.toEqual([
      "-1",
      "-11",
      "-256",
      NA,
      "3",
      "0",
      NA,
      "11",
      "17",
      "hexmode",
      "hexmode",
      "hexmode",
    ]);
    await expect(
      runtime.eval(
        "m <- as.hexmode(matrix(1:4, 2, dimnames = list(c('r1', 'r2'), c('a', 'b'))))\ns <- m[c(4, 2, 1)]\ny <- as.hexmode(structure(c('a', 'ff'), names = c('x', 'y'), tag = 'drop'))\nc(dim(m), rownames(m), colnames(m), class(m), as.integer(s), class(s), is.null(names(y)), is.null(attr(y, 'tag')))",
      ),
    ).resolves.toEqual([
      "2",
      "2",
      "r1",
      "r2",
      "a",
      "b",
      "hexmode",
      "4",
      "2",
      "1",
      "hexmode",
      "TRUE",
      "TRUE",
    ]);
    const printed = await runtime.evalDetailed("print(as.hexmode(c(a = 10L, b = 255L)))");
    expect(printed.value).toEqual([10, 255]);
    expect(printed.visible).toBe(false);
    expect(printed.output.map((event) => event.text).join("")).toContain('"0a" "ff"');
    await expect(runtime.eval("as.hexmode(1.5)")).rejects.toMatchObject({ code: "NRE2142" });
    await expect(runtime.eval("as.hexmode(TRUE)")).rejects.toMatchObject({ code: "NRE2142" });
    await expect(runtime.eval("as.hexmode('80000000')")).rejects.toMatchObject({
      code: "NRE2142",
    });
    const outside = await runtime.evalDetailed("try(as.hexmode(Inf), silent = TRUE)");
    expect(outside.warnings).toEqual([
      { code: "NRW1104", message: "NAs introduced by coercion to integer range" },
    ]);
    await runtime.dispose();
  });

  it("computes usage-ranked logistic quantiles with stable tail probabilities", async () => {
    const runtime = await session();
    const lowerQuartile = Math.log(0.25) - Math.log1p(-0.25);
    const upperQuartile = Math.log(0.75) - Math.log1p(-0.75);
    await expect(runtime.eval("qlogis(c(0, 0.25, 0.5, 0.75, 1))")).resolves.toEqual([
      Number.NEGATIVE_INFINITY,
      lowerQuartile,
      0,
      upperQuartile,
      Number.POSITIVE_INFINITY,
    ]);
    await expect(
      runtime.eval(
        "c(qlogis(c(0.25, 0.5, 0.75), location = 10, scale = 2), qlogis(c(0.25, 0.5, 0.75), lower.tail = FALSE), qlogis(log(c(0.25, 0.5, 0.75)), log.p = TRUE))",
      ),
    ).resolves.toEqual([
      10 + 2 * lowerQuartile,
      10,
      10 + 2 * upperQuartile,
      -lowerQuartile,
      0,
      -upperQuartile,
      lowerQuartile,
      0,
      1.09861228866811,
    ]);
    await expect(
      runtime.eval(
        "x <- qlogis(structure(setNames(c(0.25, 0.75), c('a', 'b')), marker = 'kept'))\ny <- qlogis(0.5, location = setNames(c(1, 2), c('x', 'y')))\nc(x, names(x), attr(x, 'marker'), y, names(y))",
      ),
    ).resolves.toEqual([
      "-1.0986122886681096",
      "1.0986122886681096",
      "a",
      "b",
      "kept",
      "1",
      "2",
      "x",
      "y",
    ]);
    await expect(
      runtime.eval("qlogis(c(0, 0.25, 0.5, 0.75, 1), location = 3, scale = 0)"),
    ).resolves.toEqual([Number.NEGATIVE_INFINITY, 3, 3, 3, Number.POSITIVE_INFINITY]);
    const invalid = await runtime.evalDetailed(
      "qlogis(c(-0.1, 1.1, NA, NaN), scale = c(1, -1, 1, 1))",
    );
    expect(invalid.value).toEqual([Number.NaN, Number.NaN, NA, Number.NaN]);
    expect(invalid.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced." }]);
    await expect(runtime.eval("qlogis(numeric(), location = 1:3)")).resolves.toEqual([]);
    await expect(runtime.eval("qlogis('0.5')")).rejects.toMatchObject({ code: "NRT3263" });
    await runtime.dispose();
  });

  it("runs the usage-ranked openssl normal and binomial quantile paths", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("qbinom(c(0, .001, .025, .1, .5, .9, .975, .999, 1), size = 10, prob = .3)"),
    ).resolves.toEqual([0, 0, 0, 1, 3, 5, 6, 8, 10]);
    await expect(
      runtime.eval(
        "c(qbinom(c(.1, .5, .9), 10, .3, lower.tail = FALSE), qbinom(log(c(.1, .5, .9)), 10, .3, log.p = TRUE), stats::qbinom(.5, 100, .3))",
      ),
    ).resolves.toEqual([5, 3, 1, 1, 3, 5, 30]);
    await expect(
      runtime.eval(
        "round(c(qnorm(c(.001, .025, .1, .5, .9, .975, .999)), qnorm(c(.1, .5, .9), mean = 10, sd = 2), qnorm(c(.1, .5, .9), lower.tail = FALSE), qnorm(log(c(.1, .5, .9)), log.p = TRUE), stats::qnorm(.5)), 12)",
      ),
    ).resolves.toEqual([
      -3.090232306168, -1.95996398454, -1.281551565545, 0, 1.281551565545, 1.95996398454,
      3.090232306168, 7.436896868911, 10, 12.563103131089, 1.281551565545, 0, -1.281551565545,
      -1.281551565545, 0, 1.281551565545, 0,
    ]);
    await expect(
      runtime.eval(
        "x <- qnorm(structure(setNames(c(.1, .9), c('a', 'b')), marker = 'kept'))\ny <- qbinom(structure(setNames(c(.1, .9), c('x', 'y')), marker = 'bins'), 10, .3)\nc(names(x), attr(x, 'marker'), names(y), attr(y, 'marker'))",
      ),
    ).resolves.toEqual(["a", "b", "kept", "x", "y", "bins"]);
    const invalid = await runtime.evalDetailed(
      "c(qnorm(c(-.1, 1.1, NA, NaN), sd = c(1, -1, 1, 1)), qbinom(c(-.1, 1.1, NA, NaN), c(1, -1, 1, 1), .3))",
    );
    expect(invalid.value).toEqual([
      Number.NaN,
      Number.NaN,
      NA,
      Number.NaN,
      Number.NaN,
      Number.NaN,
      NA,
      Number.NaN,
    ]);
    expect(invalid.warnings).toEqual([
      { code: "NRW1003", message: "NaNs produced." },
      { code: "NRW1003", message: "NaNs produced." },
    ]);
    await expect(runtime.eval("qnorm(numeric(), mean = 1:3)")).resolves.toEqual([]);
    await expect(runtime.eval("qbinom(.5, 10000001, .3)")).rejects.toMatchObject({
      code: "NRU6152",
    });
    await expect(runtime.eval("qnorm(-1000, log.p = TRUE)")).rejects.toMatchObject({
      code: "NRU6153",
    });
    await runtime.dispose();
  });

  it("constructs named equal-length data frames on the list value model", async () => {
    const runtime = await session();
    await runtime.eval('df <- data.frame(x = 1:3, label = c("a", "b", "c"), constant = 10)');
    await expect(runtime.eval("names(df)")).resolves.toEqual(["x", "label", "constant"]);
    await expect(runtime.eval("nrow(df)")).resolves.toBe(3);
    await expect(runtime.eval("ncol(df)")).resolves.toBe(3);
    await expect(runtime.eval("dim(df)")).resolves.toEqual([3, 3]);
    await expect(runtime.eval("df$x")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("df$constant")).resolves.toEqual([10, 10, 10]);
    await expect(runtime.eval("nrow(as.data.frame(c(4, 5)))")).resolves.toBe(2);
    await expect(runtime.eval("data.frame(a = 1:2, b = 1:3)")).rejects.toMatchObject({
      code: "NRE2116",
    });
    await expect(runtime.eval("names(data.frame(1:3))")).resolves.toBe("X1");
    await runtime.dispose();
  });

  it("runs posterior's usage-ranked vectorized normal probability example", async () => {
    const runtime = await session();
    await expect(runtime.eval("round(stats::pnorm(1.5, mean = 1:4, sd = 2), 12)")).resolves.toEqual(
      [0.598706325683, 0.401293674317, 0.226627352377, 0.105649773667],
    );
    await expect(
      runtime.eval(
        "round(c(pnorm(c(-3, -1, 0, 1, 3)), pnorm(c(-3, 0, 3), lower.tail = FALSE)), 12)",
      ),
    ).resolves.toEqual([
      0.001349898032, 0.158655253931, 0.5, 0.841344746069, 0.998650101968, 0.998650101968, 0.5,
      0.001349898032,
    ]);
    await expect(runtime.eval("pnorm(-50, log.p = TRUE)")).resolves.toBeCloseTo(
      -1254.8313611394199,
      11,
    );
    await expect(runtime.eval("pnorm(50, lower.tail = FALSE, log.p = TRUE)")).resolves.toBeCloseTo(
      -1254.8313611394199,
      11,
    );
    await expect(
      runtime.eval(
        "x <- structure(setNames(c(-1, 1), c('a', 'b')), marker = 'kept')\ny <- pnorm(x)\nc(y, names(y), attr(y, 'marker'))",
      ),
    ).resolves.toEqual(["0.1586552539314569", "0.841344746068543", "a", "b", "kept"]);
    await expect(
      runtime.eval(
        "c(pnorm(c(-1, 0, 1), sd = 0), pnorm(c(-1, 0, 1), sd = 0, lower.tail = FALSE, log.p = TRUE))",
      ),
    ).resolves.toEqual([0, 1, 1, 0, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]);
    const invalid = await runtime.evalDetailed(
      "pnorm(c(0, NA, NaN, Inf), mean = c(0, 0, 0, Inf), sd = c(-1, -1, -1, 1))",
    );
    expect(invalid.value).toEqual([Number.NaN, NA, Number.NaN, Number.NaN]);
    expect(invalid.warnings).toEqual([{ code: "NRW1003", message: "NaNs produced" }]);
    const controls = await runtime.evalDetailed(
      "c(pnorm(1, lower.tail = '0'), pnorm(1, lower.tail = 'FALSE'), pnorm(1, lower.tail = logical()), pnorm(1, log.p = logical()))",
    );
    expect(controls.value).toEqual([
      0.1586552539314569, 0.841344746068543, 0.841344746068543, -0.1727537790234497,
    ]);
    expect(controls.warnings).toEqual([{ code: "NRW1003", message: "NAs introduced by coercion" }]);
    await expect(runtime.eval("pnorm(numeric(), mean = 1:3)")).resolves.toEqual([]);
    await expect(runtime.eval("pnorm(1:3, mean = numeric())")).resolves.toEqual([]);
    await expect(runtime.eval("pnorm('0')")).rejects.toMatchObject({ code: "NRT3304" });
    await runtime.dispose();
  });

  it("runs posterior's usage-ranked gamma random-generation examples", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "set.seed(11)\nsigma <- stats::rgamma(1, shape = 1, rate = 1)\nc(length(sigma), sigma > 0, sigma < Inf)",
      ),
    ).resolves.toEqual([1, 1, 1]);
    await expect(
      runtime.eval(
        "set.seed(17)\na <- rgamma(8, c(1, 2), rate = c(1, 2, 3))\nset.seed(17)\nb <- rgamma(8, c(1, 2), scale = 1 / c(1, 2, 3))\nset.seed(99)\nz <- rgamma(4000, 2, scale = 3)\nc(identical(a, b), all(a >= 0), length(a), length(rgamma(c(7, 8), 2)), length(rgamma(2.9, 2)), length(rgamma(numeric(), 2)), is.null(names(rgamma(setNames(1, 'n'), setNames(2, 'shape')))), abs(mean(z) - 6) < .3, abs(var(z) - 18) < 2)",
      ),
    ).resolves.toEqual([1, 1, 8, 2, 2, 0, 1, 1, 1]);
    const boundaries = await runtime.evalDetailed(
      "rgamma(8, c(0, Inf, 2, 2, Inf, 0, -1, NA), scale = c(1, 1, 0, Inf, 0, Inf, 1, 1))",
    );
    expect(boundaries.value).toEqual([
      0,
      Number.POSITIVE_INFINITY,
      0,
      Number.POSITIVE_INFINITY,
      0,
      0,
      Number.NaN,
      Number.NaN,
    ]);
    expect(boundaries.warnings).toEqual([{ code: "NRW1003", message: "NAs produced" }]);
    const empty = await runtime.evalDetailed("rgamma(2, numeric())");
    expect(empty.value).toEqual([NA, NA]);
    expect(empty.warnings).toEqual([{ code: "NRW1003", message: "NAs produced" }]);
    const redundant = await runtime.evalDetailed("rgamma(1, 2, rate = 1, scale = 1)");
    expect(redundant.value).toBeGreaterThan(0);
    expect(redundant.warnings).toEqual([
      { code: "NRW1024", message: "specify 'rate' or 'scale' but not both" },
    ]);
    await expect(runtime.eval("rgamma(1, 2, rate = 2, scale = 1)")).rejects.toMatchObject({
      code: "NRE2194",
    });
    await expect(runtime.eval("rgamma(-1, 2)")).rejects.toMatchObject({ code: "NRT3308" });
    await expect(runtime.eval("rgamma(1, 2 + 0i)")).rejects.toMatchObject({ code: "NRT3309" });
    await runtime.dispose();
  });

  it("performs immutable direct-binding subset and member replacement", async () => {
    const runtime = await session();
    await expect(runtime.eval("x <- 1:3\nx[2] <- 10\nx")).resolves.toEqual([1, 10, 3]);
    await expect(runtime.eval("x[c(1, 3)] <- c(9, 8)\nx")).resolves.toEqual([9, 10, 8]);
    await expect(runtime.eval("x[c(TRUE, FALSE, TRUE)] <- 0\nx")).resolves.toEqual([0, 10, 0]);
    await expect(runtime.eval("x[[2]] <- NA\nx")).resolves.toEqual([0, NA, 0]);
    await expect(runtime.eval('x <- c(a = 1, b = 2)\nx["b"] <- 5\nx')).resolves.toEqual([1, 5]);
    await expect(
      runtime.eval("items <- list(a = 1)\nitems$a <- 2\nitems$b <- c(3, 4)\nitems$b"),
    ).resolves.toEqual([3, 4]);
    await runtime.eval("df <- data.frame(x = 1:3)\ndf$x <- c(4, 5, 6)\ndf$constant <- 10");
    await expect(runtime.eval("df$x")).resolves.toEqual([4, 5, 6]);
    await expect(runtime.eval("df$constant")).resolves.toEqual([10, 10, 10]);
    await expect(runtime.eval("ncol(df)")).resolves.toBe(2);
    await expect(
      runtime.eval(
        "items <- list(a = 1, b = 2, c = 3)\nitems$b <- NULL\nitems[[1]] <- NULL\nnames(items)",
      ),
    ).resolves.toBe("c");
    await expect(
      runtime.eval("items <- list(a = 1, b = 2, c = 3)\nitems[c(1, 3)] <- NULL\nnames(items)"),
    ).resolves.toBe("b");
    await runtime.eval("df <- data.frame(x = 1:2, y = 3:4)\ndf$x <- NULL");
    await expect(runtime.eval("names(df)")).resolves.toBe("y");
    await runtime.eval("m <- matrix(1:4, nrow = 2)\nm[1] <- 9");
    await expect(runtime.evalRaw("m")).resolves.toMatchObject({ dim: [2, 2] });
    await expect(runtime.eval("x <- 1:2\nx[5] <- 9L\nx")).resolves.toEqual([1, 2, NA, NA, 9]);
    await expect(runtime.eval("x[1] <- seq_len(0)")).rejects.toMatchObject({ code: "NRT3129" });
    await runtime.dispose();
  });

  it("extends vectors, lists, and data-frame columns during replacement", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("x <- c(a = 1L, b = 2L)\nx[4] <- 9L\nc(x, length(x), names(x), is.na(x))"),
    ).resolves.toEqual([
      "1",
      "2",
      NA,
      "9",
      "4",
      "a",
      "b",
      "",
      "",
      "FALSE",
      "FALSE",
      "TRUE",
      "FALSE",
    ]);
    await expect(
      runtime.eval('x <- c(a = 1L, b = 2L)\nx[c("c", "a", "d")] <- c(3L, 10L, 4L)\nc(x, names(x))'),
    ).resolves.toEqual(["10", "2", "3", "4", "a", "b", "c", "d"]);
    await expect(
      runtime.eval('x <- c(a = 1L)\nx[c("b", "b", "")] <- 2:4\nc(x, names(x))'),
    ).resolves.toEqual(["1", "3", "4", "a", "b", ""]);
    await expect(
      runtime.eval("x <- 1:2\nx[c(FALSE, FALSE, TRUE, FALSE, TRUE)] <- c(30L, 50L)\nx"),
    ).resolves.toEqual([1, 2, 30, NA, 50]);
    await expect(runtime.eval("x <- 1:2\nx[c(1, NA, 5)] <- 9L\nx")).resolves.toEqual([
      9,
      2,
      NA,
      NA,
      9,
    ]);
    await expect(
      runtime.eval("x <- 1:3\nx[c(TRUE, NA, FALSE)] <- c(9L, 10L)"),
    ).rejects.toMatchObject({ code: "NRE2212" });
    await expect(runtime.eval("x <- 1:2\nx[Inf] <- 9L\nx")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("x <- 1:2\nx[[5]] <- 9L\nx")).resolves.toEqual([1, 2, NA, NA, 9]);
    await expect(runtime.eval('x <- c(a = 1L)\nx[["b"]] <- 2L\nc(x, names(x))')).resolves.toEqual([
      "1",
      "2",
      "a",
      "b",
    ]);
    await expect(runtime.eval("x <- list(a = 1)\nx[4] <- 9\nx")).resolves.toEqual([
      1,
      null,
      null,
      9,
    ]);
    await expect(runtime.eval("x <- list(a = 1)\nx[[4]] <- 9\nx")).resolves.toEqual([
      1,
      null,
      null,
      9,
    ]);
    await expect(
      runtime.eval("x <- list(a = 1)\nx[4] <- NULL\nc(length(x), names(x))"),
    ).resolves.toEqual(["3", "a", "", ""]);
    await expect(
      runtime.eval("x <- matrix(1:4, 2)\nx[5] <- 9L\nc(x, is.null(dim(x)), is.null(dimnames(x)))"),
    ).resolves.toEqual([1, 2, 3, 4, 9, 1, 1]);
    await expect(
      runtime.eval("df <- data.frame(x = 1:2)\ndf[2] <- 9L\nc(names(df), df$x, df$V2, dim(df))"),
    ).resolves.toEqual(["x", "V2", "1", "2", "9", "9", "2", "2"]);
    await expect(
      runtime.eval('df <- data.frame(x = 1:2)\ndf[["z"]] <- 3:4\nc(names(df), df$z)'),
    ).resolves.toEqual(["x", "z", "3", "4"]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2)\ndf[c("y", "z")] <- list(3:4, 5L)\nc(names(df), df$y, df$z)',
      ),
    ).resolves.toEqual(["x", "y", "z", "3", "4", "5", "5"]);
    await expect(runtime.eval("df <- data.frame(x = 1:2)\ndf[3] <- 9L")).rejects.toMatchObject({
      code: "NRE2221",
    });
    await expect(runtime.eval('x <- c(a = 1L)\nx[c("b", NA)] <- 2L')).rejects.toMatchObject({
      code: "NRU6131",
    });
    await expect(
      runtime.eval(
        'x <- factor(c("a", "b"))\nx[4] <- "a"\nc(as.character(x), levels(x), typeof(x))',
      ),
    ).resolves.toEqual(["a", "b", NA, "a", "a", "b", "integer"]);
    const invalidFactor = await runtime.evalDetailed(
      'x <- factor(c("a", "b"))\nx[3] <- "missing"\nx',
    );
    expect(invalidFactor.value).toEqual([1, 2, NA]);
    expect(invalidFactor.warnings).toEqual([
      expect.objectContaining({ code: "NRW1009", message: "invalid factor level, NA generated" }),
    ]);
    await runtime.dispose();
  });

  it("extends data-frame rows through rectangular replacement", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2, y = 3:4)\ndf[4, "x"] <- 9L\nc(df$x, df$y, rownames(df), dim(df))',
      ),
    ).resolves.toEqual(["1", "2", NA, "9", "3", "4", NA, NA, "1", "2", "3", "4", "4", "2"]);
    await expect(
      runtime.eval("df <- data.frame(x = 1:2, y = 3:4)\ndf[4, ] <- c(9L, 10L)\nc(df$x, df$y)"),
    ).resolves.toEqual([1, 2, NA, 9, 3, 4, NA, 10]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2, y = 3:4)\ndf["new", "x"] <- 9L\nc(df$x, df$y, rownames(df))',
      ),
    ).resolves.toEqual(["1", "2", "9", "3", "4", NA, "1", "2", "new"]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2, y = 3:4)\ndf[c(4, 3), "x"] <- c(9L, 8L)\nc(df$x, df$y)',
      ),
    ).resolves.toEqual([1, 2, 8, 9, 3, 4, NA, NA]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2)\ndf[4, "z"] <- 9L\nc(names(df), df$x, df$z, rownames(df))',
      ),
    ).resolves.toEqual(["x", "z", "1", "2", NA, NA, NA, NA, NA, "9", "1", "2", "3", "4"]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2, label = c("a", "b"))\ndf[3, ] <- list(9L, "z")\nc(df$x, df$label, rownames(df))',
      ),
    ).resolves.toEqual(["1", "2", "9", "a", "b", "z", "1", "2", "3"]);
    await expect(
      runtime.eval(
        'df <- data.frame(x = 1:2)\nattr(df, "row.names") <- c("a", "b")\ndf[4, "x"] <- 9L\nc(df$x, rownames(df))',
      ),
    ).resolves.toEqual(["1", "2", NA, "9", "a", "b", "3", "4"]);
    await expect(
      runtime.eval('df <- data.frame(x = 1:2, y = 3:4)\ndf[c(FALSE, FALSE, TRUE), "x"] <- 9L'),
    ).rejects.toMatchObject({ code: "NRE2222" });
    await expect(
      runtime.eval('df <- data.frame(x = 1:2, y = 3:4)\ndf[c(1, NA, 4), "x"] <- 9L'),
    ).rejects.toMatchObject({ code: "NRE2212" });
    await expect(
      runtime.eval("df <- data.frame(x = 1:2, y = 3:4)\ndf$x[4] <- 9L"),
    ).rejects.toMatchObject({ code: "NRE2116" });
    await runtime.dispose();
  });

  it("rebuilds nested subset and member replacement chains", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("x <- list(a = list(b = 1, c = 2))\nx$a$b <- 10\nc(x$a$b, x$a$c)"),
    ).resolves.toEqual([10, 2]);
    await expect(
      runtime.eval(
        "x <- list(list(1, 2), list(3, 4))\nx[[2]][[1]] <- 30\nc(x[[1]][[1]], x[[1]][[2]], x[[2]][[1]], x[[2]][[2]])",
      ),
    ).resolves.toEqual([1, 2, 30, 4]);
    await expect(runtime.eval("x <- list(a = c(1, 2, 3))\nx$a[2] <- 20\nx$a")).resolves.toEqual([
      1, 20, 3,
    ]);
    await expect(
      runtime.eval("x <- list(a = list(b = 1, c = 2))\nx$a$b <- NULL\nc(names(x$a), x$a$c)"),
    ).resolves.toEqual(["c", "2"]);
    await expect(
      runtime.eval("df <- data.frame(x = 1:3, y = 4:6)\ndf$x[2] <- 20\ndf$x"),
    ).resolves.toEqual([1, 20, 3]);
    await expect(
      runtime.eval(
        "tracker <- 0\nselect <- function() { tracker <<- tracker + 1; 1 }\nx <- list(list(answer = 1))\nx[[select()]]$answer <- 42\nc(x[[1]]$answer, tracker)",
      ),
    ).resolves.toEqual([42, 2]);
    await expect(
      runtime.eval("x <- list(a = list(b = 1))\nupdate <- function() x$a$b <<- 9\nupdate()\nx$a$b"),
    ).resolves.toBe(9);
    await expect(
      runtime.eval("x <- list()\nx$a$b <- 1\nc(x$a$b, names(x), names(x$a))"),
    ).resolves.toEqual(["1", "a", "b"]);
    await expect(
      runtime.eval('x <- list(alpha = list(answer = 1))\nx[["al", exact = FALSE]]$answer <- 5'),
    ).rejects.toMatchObject({ code: "NRE2202" });
    await runtime.dispose();
  });

  it("invokes direct replacement functions and rebinds their first argument", async () => {
    const runtime = await session();
    await expect(runtime.eval('x <- c(10, 20)\nc("a", "b") -> names(x)\nx["b"]')).resolves.toBe(20);
    await runtime.eval('attr(x, "tag") <- "ok"');
    await expect(runtime.eval('attr(x, "tag")')).resolves.toBe("ok");
    await runtime.eval('attr(x, "tag") <- NULL');
    await expect(runtime.eval('attr(x, "tag")')).resolves.toBeNull();
    await runtime.eval('attr(x, "names") <- c("left", "right")');
    await expect(runtime.eval("names(x)")).resolves.toEqual(["left", "right"]);
    await runtime.eval('class(x) <- "score"');
    await expect(runtime.eval('inherits(x, "score")')).resolves.toBe(true);
    await runtime.eval('attr(x, "class") <- NULL');
    await expect(runtime.eval("class(x)")).resolves.toBe("numeric");
    await runtime.eval('attr(x, "dim") <- c(1, 2)');
    await expect(runtime.eval("dim(x)")).resolves.toEqual([1, 2]);
    await runtime.eval("dim(x) <- NULL\nnames(x) <- NULL");
    await expect(runtime.eval("names(x)")).resolves.toBeNull();
    await runtime.eval("y <- 1:4\nnames(y) <- c('a', 'b', 'c', 'd')\ndim(y) <- c(2, 2)");
    await expect(runtime.eval("dim(y)")).resolves.toEqual([2, 2]);
    await expect(runtime.eval("names(y)")).resolves.toBeNull();
    await runtime.eval("dim(y) <- NULL");
    await expect(runtime.eval("dim(y)")).resolves.toBeNull();
    await expect(
      runtime.eval(
        'outer <- 1:2\nf <- function() { names(outer) <- c("local.a", "local.b"); names(outer) }\nc(f(), is.null(names(outer)))',
      ),
    ).resolves.toEqual(["local.a", "local.b", "TRUE"]);
    await expect(
      runtime.eval(
        'outer <- 1:2\nf <- function() names(outer) <<- c("global.a", "global.b")\nf()\nnames(outer)',
      ),
    ).resolves.toEqual(["global.a", "global.b"]);
    await expect(runtime.eval('names(x) <- "short"')).rejects.toMatchObject({
      code: "NRT3199",
    });
    await expect(runtime.eval("class(x) <- as.character(NULL)")).rejects.toMatchObject({
      code: "NRT3203",
    });
    await expect(runtime.eval('names(not.found) <- c("a", "b")')).rejects.toMatchObject({
      code: "NRE2001",
    });
    await expect(runtime.eval("unknown(x) <- 1")).rejects.toMatchObject({
      code: "NRE2001",
    });
    await expect(runtime.eval('names(1:2) <- c("a", "b")')).rejects.toMatchObject({
      code: "NRU6001",
    });
    await runtime.dispose();
  });

  it("queries and replaces zoo's usage-ranked comment attribute", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        x1 <- structure(1:5, class = "zoo", index = 1:5)
        visible <- withVisible(comment(x1) <- c(
          "This is a very simple example of a zoo object.",
          "It can be recreated using this R code: example(zoo)"
        ))
        c(
          base::comment(x1),
          attr(x1, "comment"),
          class(x1),
          visible$value,
          visible$visible
        )
      `),
    ).resolves.toEqual([
      "This is a very simple example of a zoo object.",
      "It can be recreated using this R code: example(zoo)",
      "This is a very simple example of a zoo object.",
      "It can be recreated using this R code: example(zoo)",
      "zoo",
      "This is a very simple example of a zoo object.",
      "It can be recreated using this R code: example(zoo)",
      "FALSE",
    ]);
    await expect(
      runtime.eval(`
        x <- structure(c(a = 1, b = 2), marker = "kept")
        comment(x) <- NA_character_
        missing <- is.na(comment(x))
        comment(x) <- character()
        removed <- is.null(comment(x))
        attr(x, "comment") <- c("first", "second")
        c(missing, removed, names(x), attr(x, "marker"), comment(x))
      `),
    ).resolves.toEqual(["TRUE", "TRUE", "a", "b", "kept", "first", "second"]);
    await expect(runtime.eval("comment(1:3)")).resolves.toBeNull();
    await expect(runtime.eval("comment(function(x) x)")).resolves.toBeNull();
    await expect(runtime.eval("x <- 1\ncomment(x) <- 2")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("x <- 1\nattr(x, 'comment') <- list('bad')")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("x <- NULL\ncomment(x) <- 'bad'")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("x <- function() 1\ncomment(x) <- 'future'")).rejects.toMatchObject({
      code: "NRU6160",
    });
    await runtime.dispose();
  });

  it("encodes factors as integer codes with exact levels", async () => {
    const runtime = await session();
    await expect(runtime.eval('f <- factor(c("b", "a", "b", NA))\nf')).resolves.toEqual([
      2,
      1,
      2,
      NA,
    ]);
    await expect(runtime.eval("levels(f)")).resolves.toEqual(["a", "b"]);
    await expect(runtime.eval('factor(c("a", "c"), levels = c("a", "b"))')).resolves.toEqual([
      1,
      NA,
    ]);
    await expect(
      runtime.eval('levels(droplevels(factor(c("a", "a"), levels = c("a", "b"))))'),
    ).resolves.toBe("a");
    await expect(runtime.eval('levels(ordered(c("low", "high")))')).resolves.toEqual([
      "high",
      "low",
    ]);
    await runtime.eval('df <- data.frame(group = factor(c("a", "b")))');
    await expect(runtime.eval("df$group")).resolves.toEqual([1, 2]);
    await runtime.dispose();
  });

  it("forwards lazy ellipsis arguments and maps with lapply", async () => {
    const runtime = await session();
    await expect(runtime.eval("f <- function(...) sum(...)\nf(1, 2, 3)")).resolves.toBe(6);
    await expect(
      runtime.eval("f <- function(x, ...) mean(x, ...)\nf(c(1, NA, 3), na.rm = TRUE)"),
    ).resolves.toBe(2);
    await expect(
      runtime.eval(
        "f <- function(..., na.rm = FALSE) mean(c(...), na.rm = na.rm)\nf(1, NA, 3, na.rm = TRUE)",
      ),
    ).resolves.toBe(2);
    await expect(runtime.eval("f <- function(...) 1\nf(not.bound)")).resolves.toBe(1);
    await expect(
      runtime.eval("g <- function(x, y) x + y\nf <- function(...) g(...)\nf(2, y = 3)"),
    ).resolves.toBe(5);
    await expect(runtime.eval("lapply(1:3, function(x) x ^ 2)")).resolves.toEqual([1, 4, 9]);
    await expect(
      runtime.eval("lapply(1:3, function(x, offset) x + offset, offset = 10)"),
    ).resolves.toEqual([11, 12, 13]);
    await expect(runtime.eval("lapply(c(-1, 2), abs)")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("sum(...)")).rejects.toMatchObject({ code: "NRE2011" });
    await runtime.dispose();
  });

  it("handles deterministic ISO dates and UTC date-times as classed numeric vectors", async () => {
    const runtime = await session();
    await expect(runtime.eval('as.Date("1970-01-03") - as.Date("1970-01-01")')).resolves.toBe(2);
    await expect(runtime.eval('as.Date(2, origin = "1970-01-01")')).resolves.toBe(2);
    await expect(
      runtime.eval(
        'c(difftime(as.POSIXct("1970-01-02 00:00:00"), as.POSIXct("1970-01-01 12:00:00"), units = "secs"))',
      ),
    ).resolves.toBe(43_200);
    await expect(
      runtime.eval('c(difftime(as.Date("1970-01-03"), as.Date("1970-01-01"), units = "days"))'),
    ).resolves.toBe(2);
    await expect(runtime.eval("length(Sys.Date())")).resolves.toBe(1);
    await expect(runtime.eval("length(Sys.time())")).resolves.toBe(1);
    await expect(runtime.eval('as.Date("2024-02-30")')).rejects.toMatchObject({
      code: "NRE2117",
    });
    await expect(
      runtime.eval('as.POSIXct("2024-01-01", tz = "America/New_York")'),
    ).rejects.toMatchObject({ code: "NRU6113" });
    await runtime.dispose();
  });

  it("sorts, matches, deduplicates, and locates vector elements", async () => {
    const runtime = await session();
    await expect(runtime.eval("sort(c(3, NA, 1, 2))")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("sort(c(3, NA, 1, 2), na.last = TRUE)")).resolves.toEqual([
      1,
      2,
      3,
      NA,
    ]);
    await expect(runtime.eval("sort(c(3, NA, 1, 2), na.last = FALSE)")).resolves.toEqual([
      NA,
      1,
      2,
      3,
    ]);
    await expect(runtime.eval("sort(c(3, NA, 1, 2), decreasing = TRUE)")).resolves.toEqual([
      3, 2, 1,
    ]);
    await expect(runtime.eval("order(c(3, NA, 1, 2))")).resolves.toEqual([3, 4, 1, 2]);
    await expect(runtime.eval("unique(c(1, 1, NA, NA, NaN, NaN))")).resolves.toEqual([
      1,
      NA,
      Number.NaN,
    ]);
    await expect(runtime.eval("duplicated(c(1, 1, NA, NA, NaN, NaN))")).resolves.toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    await expect(runtime.eval('match(c("b", "x", "a"), c("a", "b"))')).resolves.toEqual([2, NA, 1]);
    await expect(runtime.eval("c(1, NA, 3) %in% c(3, NA)")).resolves.toEqual([false, true, true]);
    await expect(runtime.eval("which(c(FALSE, TRUE, NA, TRUE))")).resolves.toEqual([2, 4]);
    await expect(runtime.eval("which.max(c(1, 5, 5, NA))")).resolves.toBe(2);
    await expect(runtime.eval("which.min(c(1, -2, -2, NA))")).resolves.toBe(2);
    await runtime.dispose();
  });

  it("normalizes usage-ranked argument choices with caller-default inference", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "a <- match.arg('be', c('alpha', 'beta', 'gamma'))\nb <- match.arg('1', 1:2)\nc <- match.arg('a', setNames(c('alpha', 'beta'), c('A', 'B')))\nc(a, b, names(c))",
      ),
    ).resolves.toEqual(["beta", "1", "A"]);
    await expect(
      runtime.eval(
        "a <- match.arg(c('be', 'alpha'), c('alpha', 'beta', 'gamma'), several.ok = TRUE)\nb <- match.arg(c('a', 'alpha'), c('alpha', 'beta'), several.ok = 'all choices')\nc <- match.arg(c('z', 'b'), c('alpha', 'beta'), several.ok = TRUE)\nc(a, b, c)",
      ),
    ).resolves.toEqual(["beta", "alpha", "alpha", "alpha", "beta"]);
    await expect(
      runtime.eval(
        "choices <- c('alpha', 'beta')\nf <- function(method = c('alpha', 'beta', 'gamma')) match.arg(method)\ng <- function(method = choices) match.arg(method)\nc(f(), f('be'), f(method = 'g'), f(c('alpha', 'beta', 'gamma')), g('b'))",
      ),
    ).resolves.toEqual(["alpha", "beta", "gamma", "alpha", "beta"]);
    await expect(runtime.eval("match.arg(NULL, c('alpha', 'beta'))")).resolves.toBe("alpha");
    await expect(
      runtime.eval("f <- function(method = NULL) match.arg(method)\nis.null(f())"),
    ).resolves.toBe(true);
    await expect(
      runtime.eval("match.arg('a', c('alpha', 'alpine', 'beta'))"),
    ).rejects.toMatchObject({ code: "NRE2130" });
    await expect(runtime.eval("match.arg(1, c('1', '2'))")).rejects.toMatchObject({
      code: "NRT3262",
    });
    await expect(
      runtime.eval("f <- function(method) match.arg(method)\nf('a')"),
    ).rejects.toMatchObject({ code: "NRE2219" });
    await runtime.dispose();
  });

  it("normalizes a deliberate formula subset without exposing parser nodes", async () => {
    const runtime = await session();
    await expect(runtime.eval("all.vars(y ~ x + z)")).resolves.toEqual(["y", "x", "z"]);
    await expect(runtime.eval("all.vars(~ x + z - x)")).resolves.toEqual(["x", "z"]);
    await expect(runtime.evalRaw("y ~ x + z + 0")).resolves.toEqual({
      version: 1,
      type: "formula",
      response: "y",
      terms: ["x", "z"],
      variables: ["y", "x", "z"],
      intercept: false,
    });
    await expect(runtime.eval("all.vars(y ~ log(x) + z:w)")).resolves.toEqual(["y", "x", "z", "w"]);
    await expect(runtime.evalRaw("y ~ x * z")).resolves.toMatchObject({
      terms: ["x", "z", "x:z"],
      variables: ["y", "x", "z"],
    });
    await expect(runtime.eval("all.vars(as.formula('y ~ log(x) + z:w'))")).resolves.toEqual([
      "y",
      "x",
      "z",
      "w",
    ]);
    await expect(runtime.evalRaw("as.formula('~ x + z + 0')")).resolves.toMatchObject({
      type: "formula",
      terms: ["x", "z"],
      variables: ["x", "z"],
      intercept: false,
    });
    await expect(runtime.eval("all.vars(as.formula(quote(y ~ x + z)))")).resolves.toEqual([
      "y",
      "x",
      "z",
    ]);
    await expect(
      runtime.eval(
        "f <- function() { marker <- 1; identical(environment(as.formula('y ~ marker')), environment()) }\nf()",
      ),
    ).resolves.toBe(true);
    await expect(
      runtime.eval(
        "c(identical(environment(as.formula('y ~ x', env = emptyenv())), emptyenv()), is.null(environment(as.formula('y ~ x', env = NULL))))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(
      runtime.eval(
        "f <- y ~ x\nc(identical(as.formula(f, env = not.bound), f), identical(environment(as.formula(f, env = emptyenv())), environment(f)))",
      ),
    ).resolves.toEqual([true, true]);
    await expect(runtime.eval("all.vars(stats::as.formula('y ~ x'))")).resolves.toEqual(["y", "x"]);

    const deprecatedCharacter = await runtime.evalDetailed(
      "all.vars(as.formula(c('y ~ x', '~ z')))",
    );
    expect(deprecatedCharacter.value).toEqual(["y", "x"]);
    expect(deprecatedCharacter.warnings).toMatchObject([{ code: "NRW1016" }]);
    await expect(runtime.eval("as.formula(character())")).rejects.toMatchObject({
      code: "NRT3249",
    });
    await expect(runtime.eval("as.formula('')")).rejects.toMatchObject({ code: "NRT3249" });
    await expect(runtime.eval("as.formula(NA_character_)")).rejects.toMatchObject({
      code: "NRT3249",
    });
    await expect(runtime.eval("as.formula('y ~ x; z ~ w')")).rejects.toMatchObject({
      code: "NRT3249",
    });
    await expect(runtime.eval("as.formula('x + z')")).rejects.toMatchObject({ code: "NRT3249" });
    await expect(runtime.eval("as.formula(expression(y ~ x))")).rejects.toMatchObject({
      code: "NRT3249",
    });
    await expect(runtime.eval("as.formula(1)")).rejects.toMatchObject({ code: "NRT3249" });
    await expect(runtime.eval("as.formula('y ~ x', env = 1)")).rejects.toMatchObject({
      code: "NRT3249",
    });
    await runtime.dispose();
  });

  it("passes native-pipe left values as the first lazy call argument", async () => {
    const runtime = await session();
    await expect(runtime.eval("1:5 |> mean()")).resolves.toBe(3);
    await expect(runtime.eval("c(1, NA, 3) |> mean(na.rm = TRUE)")).resolves.toBe(2);
    await expect(runtime.eval("1:3 |> sum(10)")).resolves.toBe(16);
    await expect(runtime.eval("1:3 |> lapply(function(x) x ^ 2)")).resolves.toEqual([1, 4, 9]);
    await expect(runtime.eval("1:3 |> mean")).rejects.toMatchObject({ code: "NRU6001" });
    await runtime.dispose();
  });

  it("evaluates magrittr-style pipes with first-position and dot insertion", async () => {
    const runtime = await session();
    await expect(runtime.eval("1:5 %>% mean()")).resolves.toBe(3);
    await expect(runtime.eval("1:3 %>% sum(10)")).resolves.toBe(16);
    await expect(runtime.eval("1:3 %>% sum(10, .)")).resolves.toBe(16);
    await expect(runtime.eval("2 %>% (function(x) x ^ 3)")).resolves.toBe(8);
    await expect(runtime.eval("c(1, NA, 3) %>% mean(na.rm = TRUE)")).resolves.toBe(2);
    await runtime.dispose();
  });

  it("supports explicit S3 class metadata", async () => {
    const runtime = await session();
    await runtime.eval('x <- structure(1:3, class = c("score", "numeric"))');
    await expect(runtime.eval("class(x)")).resolves.toEqual(["score", "numeric"]);
    await expect(runtime.eval('inherits(x, "score")')).resolves.toBe(true);
    await expect(runtime.eval('inherits(x, c("missing", "score"), which = TRUE)')).resolves.toEqual(
      [0, 1],
    );
    await expect(runtime.eval("is.object(x)")).resolves.toBe(true);
    await expect(runtime.eval("is.object(unclass(x))")).resolves.toBe(false);
    await expect(runtime.eval("class(unclass(x))")).resolves.toBe("integer");
    await expect(runtime.eval("class(matrix(1:4, nrow = 2))")).resolves.toEqual([
      "matrix",
      "array",
    ]);
    await expect(runtime.eval("class(y ~ x)")).resolves.toBe("formula");
    await expect(
      runtime.eval('f <- structure(1:2, levels = c("low", "high"), class = "factor")\nlevels(f)'),
    ).resolves.toEqual(["low", "high"]);
    await runtime.dispose();
  });

  it("covers list conversion, pairlists, and fixed-length repetition", async () => {
    const runtime = await session();
    await expect(runtime.eval("x <- as.list(c(a = 10, b = 20))\nx$a + x$b")).resolves.toBe(30);
    await expect(runtime.eval("names(as.list(c(a = 1, b = 2)))")).resolves.toEqual(["a", "b"]);
    await expect(runtime.eval("class(pairlist(first = 1, second = 2))")).resolves.toBe("pairlist");
    await expect(
      runtime.eval(
        "p <- pairlist(first = 1, second = 2)\nc(typeof(p), mode(p), length(p), is.pairlist(p), is.list(p), is.vector(p), is.recursive(p))",
      ),
    ).resolves.toEqual(["pairlist", "pairlist", "2", "TRUE", "TRUE", "FALSE", "TRUE"]);
    await expect(runtime.eval("p <- pairlist(first = 1, second = 2)\nnames(p)")).resolves.toEqual([
      "first",
      "second",
    ]);
    await expect(
      runtime.eval("p <- pairlist(first = 1, second = 2)\nas.list(p)$second"),
    ).resolves.toBe(2);
    await expect(
      runtime.eval("p <- as.pairlist(c(a = 1, b = 2))\nc(typeof(p), length(p), names(p))"),
    ).resolves.toEqual(["pairlist", "2", "a", "b"]);
    await expect(
      runtime.eval("p <- as.pairlist(expression(x, y))\nc(typeof(p), length(p))"),
    ).resolves.toEqual(["pairlist", "2"]);
    await expect(runtime.eval("c(is.null(pairlist()), is.pairlist(NULL))")).resolves.toEqual([
      true,
      true,
    ]);
    await expect(
      runtime.eval('c(typeof(vector("pairlist", 2)), length(vector("pairlist", 2)))'),
    ).resolves.toEqual(["pairlist", "2"]);
    await expect(
      runtime.eval(
        'p <- pairlist(alpha = 1, beta = 2, gamma = 3)\nq <- p[c(1, 3)]\nc(typeof(q), names(q), q[[2]], p[["beta"]], p$alp, is.null(pairlist(alpha = 1, alpine = 2)$al))',
      ),
    ).resolves.toEqual(["list", "alpha", "gamma", "3", "2", "1", "TRUE"]);
    await expect(
      runtime.eval(
        "p <- pairlist(a = 1, b = 2)\np[[2]] <- 20\np$c <- 3\np$a <- NULL\nc(typeof(p), names(p), p$b, p$c)",
      ),
    ).resolves.toEqual(["pairlist", "b", "c", "20", "3"]);
    await expect(
      runtime.eval(
        'p <- structure(pairlist(a = 1, b = 2), marker = "kept", class = "tagged")\np[[1]] <- 9\nq <- p\nq[1] <- list(10)\nc(typeof(p), class(p), attr(p, "marker"), names(p), typeof(q), class(q), attr(q, "marker"), q[[1]])',
      ),
    ).resolves.toEqual(["pairlist", "tagged", "kept", "a", "b", "list", "tagged", "kept", "10"]);
    await expect(
      runtime.eval(
        'p <- structure(pairlist(1, 2, 3, 4), dim = c(2, 2), dimnames = list(c("r1", "r2"), c("c1", "c2")))\nc(typeof(p), class(p), dim(p), is.matrix(p), is.array(p), p[[1, 2]], p[1, 2][[1]], rownames(p), colnames(p))',
      ),
    ).resolves.toEqual([
      "pairlist",
      "matrix",
      "array",
      "2",
      "2",
      "FALSE",
      "FALSE",
      "3",
      "3",
      "r1",
      "r2",
      "c1",
      "c2",
    ]);
    await expect(
      runtime.eval(
        'p <- pairlist(a = 1, b = 2)\nnames(p) <- c("x", "y")\nq <- unname(p)\nnames(q) <- c("left", "right")\nc(typeof(q), names(q))',
      ),
    ).resolves.toEqual(["pairlist", "left", "right"]);
    await expect(runtime.eval("lengths(pairlist(a = 1:2, b = NULL))")).rejects.toMatchObject({
      code: "NRT3204",
    });
    await expect(
      runtime.eval(
        "a <- alist(first = , second = 1 + 2)\nc(typeof(a), length(a), names(a), deparse(a[[1]]), deparse(a[[2]]))",
      ),
    ).resolves.toEqual(["list", "2", "first", "second", "", "(1 + 2)"]);
    await expect(runtime.eval("a <- alist(x = never_defined)\nis.symbol(a[[1]])")).resolves.toBe(
      true,
    );
    await expect(runtime.eval("as.list(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval("rep_len(c(1, 2, 3), 8)")).resolves.toEqual([1, 2, 3, 1, 2, 3, 1, 2]);
    await expect(runtime.eval("rep_len(c(a = 1, b = 2), 3)")).resolves.toEqual([1, 2, 1]);
    await runtime.dispose();
  });

  it("reads supported attributes and dimension-name axes exactly", async () => {
    const runtime = await session();
    await runtime.eval(
      'm <- structure(matrix(1:4, nrow = 2), dimnames = list(c("r1", "r2"), c("c1", "c2")), class = c("score_matrix", "matrix"))',
    );
    await expect(runtime.eval('attr(m, "class")')).resolves.toEqual(["score_matrix", "matrix"]);
    await expect(runtime.eval("names(attributes(m))")).resolves.toEqual([
      "dim",
      "dimnames",
      "class",
    ]);
    await expect(runtime.eval("rownames(m)")).resolves.toEqual(["r1", "r2"]);
    await expect(runtime.eval("colnames(m)")).resolves.toEqual(["c1", "c2"]);
    await expect(runtime.eval("dimnames(m)[[1]]")).resolves.toEqual(["r1", "r2"]);
    await expect(runtime.eval("names(unname(c(a = 1, b = 2)))")).resolves.toBeNull();
    await runtime.eval("df <- data.frame(x = 1:2)");
    await expect(runtime.eval("rownames(df)")).resolves.toEqual(["1", "2"]);
    await expect(runtime.eval("colnames(df)")).resolves.toBe("x");
    await runtime.dispose();
  });

  it("ranks atomic values with deterministic tie and missing policies", async () => {
    const runtime = await session();
    await expect(runtime.eval("rank(c(30, 10, 20))")).resolves.toEqual([3, 1, 2]);
    await expect(runtime.eval("rank(c(10, 20, 20, 30))")).resolves.toEqual([1, 2.5, 2.5, 4]);
    await expect(runtime.eval('rank(c(10, 20, 20, 30), ties.method = "min")')).resolves.toEqual([
      1, 2, 2, 4,
    ]);
    await expect(runtime.eval('rank(c(10, NA, 20), na.last = "keep")')).resolves.toEqual([
      1,
      NA,
      2,
    ]);
    await expect(runtime.eval("rank(c(10, NA, 20), na.last = FALSE)")).resolves.toEqual([2, 1, 3]);
    await runtime.dispose();
  });

  it("binds atomic vectors and matrices and retains validated dimension names", async () => {
    const runtime = await session();
    await expect(runtime.eval("dim(rbind(1:3, 4:6))")).resolves.toEqual([2, 3]);
    await expect(runtime.eval("rbind(1:3, 4:6)")).resolves.toEqual([1, 4, 2, 5, 3, 6]);
    await expect(runtime.eval("dim(cbind(1:3, 4:6))")).resolves.toEqual([3, 2]);
    await expect(runtime.eval("cbind(1:3, 4:6)")).resolves.toEqual([1, 2, 3, 4, 5, 6]);
    await expect(
      runtime.eval("rbind(matrix(1:4, nrow = 2), matrix(5:8, nrow = 2))"),
    ).resolves.toEqual([1, 2, 5, 6, 3, 4, 7, 8]);
    await runtime.eval('m <- matrix(1:4, nrow = 2, dimnames = list(c("r1", "r2"), c("c1", "c2")))');
    await expect(runtime.eval("rownames(m)")).resolves.toEqual(["r1", "r2"]);
    await expect(runtime.eval("colnames(m)")).resolves.toEqual(["c1", "c2"]);
    await runtime.dispose();
  });

  it("implements the complete measured string-helper surface", async () => {
    const runtime = await session();
    await expect(runtime.eval('sprintf("%s-%02d", "item", 3)')).resolves.toBe("item-03");
    await expect(runtime.eval('sprintf("%.2f", c(1.2, 3.456))')).resolves.toEqual(["1.20", "3.46"]);
    await expect(runtime.eval("format(c(1.2, 12.34), trim = TRUE, nsmall = 2)")).resolves.toEqual([
      "1.20",
      "12.34",
    ]);
    await expect(runtime.eval('grep("^a", c("apple", "pear", "apricot"))')).resolves.toEqual([
      1, 3,
    ]);
    await expect(
      runtime.eval('grep("a", c("apple", "pear", "plum"), value = TRUE)'),
    ).resolves.toEqual(["apple", "pear"]);
    await expect(runtime.eval('grepl("a", c("apple", NA, "plum"))')).resolves.toEqual([
      true,
      NA,
      false,
    ]);
    await expect(runtime.eval('gsub("[0-9]", "X", "a1b2")')).resolves.toBe("aXbX");
    await expect(runtime.eval('sub("[0-9]", "X", "a1b2")')).resolves.toBe("aXb2");
    await expect(runtime.eval('strsplit(c("a,b", "c,d"), ",")')).resolves.toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    await expect(runtime.eval('substring("abcdef", 2, 4)')).resolves.toBe("bcd");
    await expect(runtime.eval('substr(c("abcdef", "uvwxyz"), 2, 3)')).resolves.toEqual([
      "bc",
      "vw",
    ]);
    await expect(runtime.eval('chartr("a-c", "A-C", "cab")')).resolves.toBe("CAB");
    await runtime.dispose();
  });

  it("translates rprojroot's usage-ranked file globs into regular expressions", async () => {
    const runtime = await session();
    await expect(runtime.eval("utils::glob2rx('DESCRIPTION')")).resolves.toBe("^DESCRIPTION$");
    await expect(
      runtime.eval("glob2rx(c('abc.*', 'a?b.*', '*.doc', '*.t*', '*.t??', '*[*'))"),
    ).resolves.toEqual(["^abc\\.", "^a.b\\.", "^.*\\.doc$", "^.*\\.t", "^.*\\.t..$", "^.*\\["]);
    await expect(
      runtime.eval(
        "c(glob2rx(c('*', '*.doc', 'abc*', '**abc'), trim.head = TRUE), glob2rx(c('*', 'abc*', 'abc', 'a?'), trim.tail = FALSE), glob2rx(c('*', '*.doc', 'abc*', '*abc*'), TRUE, TRUE))",
      ),
    ).resolves.toEqual([
      "^",
      "\\.doc$",
      "^abc",
      ".*abc$",
      "^.*$",
      "^abc.*$",
      "^abc$",
      "^a.$",
      "^",
      "\\.doc$",
      "^abc",
      "abc",
    ]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = NA, b = 1, c = TRUE), dim = c(3, 1)); y <- glob2rx(x); c(y, is.null(names(y)), is.null(dim(y)), glob2rx(list('a*', 1, TRUE, NA, NULL)), glob2rx(list(c('a', 'b'), 1:3)))",
      ),
    ).resolves.toEqual([
      "^NA$",
      "^1$",
      "^1$",
      "TRUE",
      "TRUE",
      "^a",
      "^1$",
      "^TRUE$",
      "^NA$",
      "^NULL$",
      '^c\\("a", "b")$',
      "^1:3$",
    ]);
    await expect(
      runtime.eval("c(glob2rx('a*', trim.head = 'TRUE'), glob2rx('a*', 1, 0))"),
    ).resolves.toEqual(["^a", "^a.*$"]);
    await expect(runtime.eval("glob2rx('a*', trim.head = c(TRUE, FALSE))")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("glob2rx('a*', trim.head = NA)")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("glob2rx('a*', trim.head = 'yes')")).rejects.toMatchObject({
      code: "NRT3335",
    });
    await expect(runtime.eval("glob2rx()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 10 },
    });
    await expect(limited.eval("glob2rx('DESCRIPTION')")).rejects.toMatchObject({ code: "NRL4007" });
    await limited.dispose();
  });

  it("quotes httr's usage-ranked request URLs with deterministic text styles", async () => {
    const runtime = await session();
    await expect(runtime.eval("sQuote('https://httpbin.org')")).resolves.toBe(
      "'https://httpbin.org'",
    );
    const logged = await runtime.evalDetailed(
      "req_url <- 'https://httpbin.org'\ncat('HTTP request to', sQuote(req_url), '\\n')",
    );
    expect(logged.output).toEqual([
      { stream: "stdout", text: "HTTP request to 'https://httpbin.org' \n" },
    ]);
    await expect(
      runtime.eval(
        "c(sQuote(c('x', NA), FALSE), sQuote('x', 'UTF-8'), sQuote('x', 'TeX'), sQuote('x', c('<', '>', '[', ']')), sQuote('x', c('', '', '[', ']')))",
      ),
    ).resolves.toEqual(["'x'", "'NA'", "‘x’", "`x'", "<x>", "x"]);
    await expect(
      runtime.eval(
        "options(useFancyQuotes = 'UTF-8'); a <- sQuote('x'); options(useFancyQuotes = c('<<', '>>', '[[', ']]')); b <- sQuote('x'); options(useFancyQuotes = NULL); c(a, b, sQuote('x'))",
      ),
    ).resolves.toEqual(["‘x’", "<<x>>", "'x'"]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = 1, b = NA), dim = c(1, 2)); y <- sQuote(x, FALSE); c(y, is.null(names(y)), is.null(dim(y)), sQuote(list('a', 1, NULL), FALSE), sQuote(~y + x, FALSE), sQuote(y ~ x, FALSE))",
      ),
    ).resolves.toEqual([
      "'1'",
      "'NA'",
      "TRUE",
      "TRUE",
      "'a'",
      "'1'",
      "'NULL'",
      "'~'",
      "'y + x'",
      "'~'",
      "'y'",
      "'x'",
    ]);
    await expect(runtime.eval("sQuote()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("sQuote(globalenv())")).rejects.toMatchObject({ code: "NRT3335" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 10 },
    });
    await expect(limited.eval("sQuote('https://httpbin.org')")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("provides distributional's usage-ranked family generic dispatch seam", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "family.distribution <- function(object, ..., label = '') c(label, class(object), length(object), list(...)$tag)\ndist <- structure(1:3, class = c('distribution', 'vctrs_vctr'))\nfamily(dist, tag = 'seen', label = 'family')",
      ),
    ).resolves.toEqual(["family", "distribution", "vctrs_vctr", "3", "seen"]);
    await expect(runtime.eval("stats::family(dist, label = 'stats')")).resolves.toEqual([
      "stats",
      "distribution",
      "vctrs_vctr",
      "3",
    ]);
    await expect(
      runtime.eval(
        "family.distribution <- function(object, ...) length(object)\ntracker <- 0\nc(family(dist, { tracker <- 1; not.bound }), tracker)",
      ),
    ).resolves.toEqual([3, 0]);
    await expect(
      runtime.eval(
        "family.distribution <- function(object, ...) NextMethod()\nfamily.vctrs_vctr <- function(object, ...) paste0('vctrs:', length(object))\nfamily(dist)",
      ),
    ).resolves.toBe("vctrs:3");
    await expect(
      runtime.eval(
        "family.default <- function(object, ...) paste0(typeof(object), list(...)$suffix)\nfamily(1, suffix = '?')",
      ),
    ).resolves.toBe("double?");
    await runtime.eval("rm(family.distribution, family.vctrs_vctr, family.default)");
    await expect(runtime.eval("family(1)")).rejects.toMatchObject({ code: "NRE2216" });
    await expect(runtime.eval("family()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();
  });

  it("emits rstudioapi's usage-ranked View call through a browser-safe data-view journal", async () => {
    const observed: {
      readonly title: string;
      readonly columns: readonly {
        readonly name: string;
        readonly values: readonly string[];
      }[];
      readonly rowNames?: readonly string[];
    }[] = [];
    const runtime = await createR({
      execution: "inline",
      assets,
      onDataView: (event) => observed.push(event),
    });
    const viewed = await runtime.evalDetailed(
      "context <- data.frame(handle = c('terminal-1', 'terminal-2'), running = c(TRUE, FALSE), lines = c(24L, NA_integer_))\nutils::View(context, 'Terminal context')",
    );
    expect(viewed.value).toBeNull();
    expect(viewed.visible).toBe(false);
    expect(viewed.dataViews).toEqual([
      {
        title: "Terminal context",
        columns: [
          { name: "handle", values: ["terminal-1", "terminal-2"] },
          { name: "running", values: ["TRUE", "FALSE"] },
          { name: "lines", values: ["24", "NA"] },
        ],
      },
    ]);
    expect(observed).toEqual(viewed.dataViews);

    const matrix = await runtime.evalDetailed("View(matrix(1:6, nrow = 2))");
    expect(matrix.dataViews).toEqual([
      {
        title: "Data: matrix((1 : 6), nrow = 2)",
        columns: [
          { name: "V1", values: ["1", "2"] },
          { name: "V2", values: ["3", "4"] },
          { name: "V3", values: ["5", "6"] },
        ],
      },
    ]);
    const named = await runtime.evalDetailed("View(c(first = 1, second = 2), NA_character_)");
    expect(named.dataViews).toEqual([
      {
        title: "NA",
        columns: [{ name: "x", values: ["1", "2"] }],
        rowNames: ["first", "second"],
      },
    ]);
    const custom = await runtime.evalDetailed(
      "as.data.frame.terminal_context <- function(x, ...) data.frame(pid = c(10L, 11L), busy = c(FALSE, TRUE))\nx <- structure(1, class = 'terminal_context')\nView(x)",
    );
    expect(custom.dataViews[0]).toEqual({
      title: "Data: x",
      columns: [
        { name: "pid", values: ["10", "11"] },
        { name: "busy", values: ["FALSE", "TRUE"] },
      ],
    });
    await expect(runtime.eval("View(data.frame(a = integer()))")).rejects.toMatchObject({
      code: "NRE2217",
    });
    await expect(
      runtime.eval("View(structure(list(), class = 'data.frame', row.names = c('1', '2')))"),
    ).rejects.toMatchObject({ code: "NRE2217" });
    await expect(runtime.eval("View(data.frame(a = 1), 12)")).rejects.toMatchObject({
      code: "NRT3337",
    });
    await expect(runtime.eval("View()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 10 },
    });
    await expect(limited.eval("View(data.frame(long_name = 1:2))")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("expands diffobj's usage-ranked home path without consulting a browser host filesystem", async () => {
    const runtime = await session();
    await expect(runtime.eval("path.expand('~')")).resolves.toBe("~");
    await expect(runtime.eval("file.path(path.expand('~'), 'web', 'mycss.css')")).resolves.toBe(
      "~/web/mycss.css",
    );
    await expect(
      runtime.eval(
        "c(file.path(c('a', 'b'), c('x', 'y'), 'z'), file.path(c('a', 'b', 'c'), c('x', 'y')), file.path(c('a', 'b'), 'x', fsep = ':'), file.path(c('a', NA_character_), c('x', 'y')))",
      ),
    ).resolves.toEqual(["a/x/z", "b/y/z", "a/x", "b/y", "c/x", "a:x", "b:x", "a/x", "NA/y"]);
    await expect(runtime.eval("file.path('a', character(), 'b')")).resolves.toEqual([]);
    await expect(runtime.eval("file.path(1:2, TRUE)")).resolves.toEqual(["1/TRUE", "2/TRUE"]);
    await expect(runtime.eval("file.path(list('a', 'b'), 'x')")).resolves.toEqual(["a/x", "b/x"]);
    await expect(
      runtime.eval(
        "x <- structure(c(first = 'relative/file', second = '', third = NA_character_), dim = c(3, 1), class = 'paths'); y <- base::path.expand(x); c(y, is.null(names(y)), is.null(dim(y)), is.null(attr(y, 'class')))",
      ),
    ).resolves.toEqual(["relative/file", "", NA, "TRUE", "TRUE", "TRUE"]);
    await expect(runtime.eval("path.expand(character())")).resolves.toEqual([]);
    await expect(runtime.eval("path.expand(NULL)")).rejects.toMatchObject({ code: "NRT3338" });
    await expect(runtime.eval("path.expand(1:2)")).rejects.toMatchObject({ code: "NRT3338" });
    await expect(runtime.eval("path.expand()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("file.path('a', 'b', fsep = NA_character_)")).rejects.toMatchObject({
      code: "NRT3339",
    });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 4 },
    });
    await expect(limited.eval("path.expand('ordinary')")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("registers diffobj's usage-ranked old-style class for bounded S4 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        setGeneric("guidesPrint", function(obj, obj.as.chr) standardGeneric("guidesPrint"))
        methods::setOldClass("zulu")
        setMethod("guidesPrint", c("zulu", "character"),
          function(obj, obj.as.chr) {
            if (length(obj) > 20) grep("^zulu[0-9]*", obj.as.chr)
            else integer(0L)
          }
        )
        z <- structure(1:21, class = "zulu")
        guidesPrint(z, paste0("zulu", 1:21))
      `),
    ).resolves.toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    await expect(
      runtime.eval(`
        setGeneric("oldLabel", function(x) standardGeneric("oldLabel"))
        setOldClass(c("old_child", "old_parent"))
        setMethod("oldLabel", "old_parent", function(x) "parent method")
        oldLabel(structure(1, class = "old_child"))
      `),
    ).resolves.toBe("parent method");
    await expect(
      runtime.eval(`
        setOldClass(c("coercion_child", "coercion_parent"))
        setOldClass("label")
        setAs("coercion_parent", "label", function(from) {
          structure(unclass(from), class = "label")
        })
        class(methods::as(structure(4, class = "coercion_child"), "label"))
      `),
    ).resolves.toBe("label");
    await expect(
      runtime.eval(`
        result <- withVisible(methods::setOldClass(
          c("visible_child", "visible_parent"),
          prototype = structure(1, note = "prototype"),
          where = globalenv()
        ))
        c(is.null(result$value), result$visible)
      `),
    ).resolves.toEqual([true, false]);
    await expect(runtime.eval("setOldClass(character())")).rejects.toMatchObject({
      code: "NRT3341",
    });
    await expect(runtime.eval("setOldClass(1)")).rejects.toMatchObject({ code: "NRT3341" });
    await expect(runtime.eval("setOldClass('old', where = 1)")).rejects.toMatchObject({
      code: "NRT3341",
    });
    await expect(runtime.eval("setOldClass('old', test = TRUE)")).rejects.toMatchObject({
      code: "NRU6132",
    });
    await expect(runtime.eval("setOldClass('old', S4Class = 'numeric')")).rejects.toMatchObject({
      code: "NRU6132",
    });
    await expect(runtime.eval("setOldClass()")).rejects.toMatchObject({ code: "NRE2103" });
    await runtime.dispose();
  });

  it("dispatches diffobj's usage-ranked show method with browser-safe output", async () => {
    const runtime = await session();
    const measured = await runtime.evalDetailed(`
      methods::setOldClass("StyleAnsi256LightYb")
      StyleAnsi256LightYb <- function() structure(list(), class = "StyleAnsi256LightYb")
      setMethod("show", "StyleAnsi256LightYb", function(object) {
        cat("styled sample\\n")
        invisible(NULL)
      })
      show(StyleAnsi256LightYb())
    `);
    expect(measured.value).toBeNull();
    expect(measured.visible).toBe(false);
    expect(measured.output).toEqual([{ stream: "stdout", text: "styled sample\n" }]);
    await expect(
      runtime.eval(`
        setOldClass("VisibleShow")
        setMethod("show", "VisibleShow", function(object) "shown")
        result <- withVisible(methods::show(structure(1, class = "VisibleShow")))
        c(result$value, result$visible)
      `),
    ).resolves.toEqual(["shown", "TRUE"]);
    await expect(
      runtime.eval(`
        setOldClass(c("ShowChild", "ShowParent"))
        setMethod("show", "ShowParent", function(object) invisible("parent"))
        result <- withVisible(show(structure(1, class = "ShowChild")))
        c(result$value, result$visible)
      `),
    ).resolves.toEqual(["parent", "FALSE"]);
    const fallback = await runtime.evalDetailed("show(list(a = 1))");
    expect(fallback.value).toBeNull();
    expect(fallback.visible).toBe(false);
    expect(fallback.output.map((event) => event.text).join("")).toBe("$a\n[1] 1\n\n");
    await expect(runtime.eval("show()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("show(1, 2)")).rejects.toMatchObject({ code: "NRE2101" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 4 },
    });
    await expect(limited.eval("show('long output')")).rejects.toMatchObject({ code: "NRL4007" });
    await limited.dispose();
  });

  it("captures httpuv's usage-ranked diagnostic output in browser memory", async () => {
    const runtime = await session();
    const observed = await runtime.evalDetailed(`
      req <- new.env()
      req$path <- "/"
      cat(capture.output(str(as.list(req))), sep = "\\n")
    `);
    expect(observed.value).toBeNull();
    expect(observed.visible).toBe(false);
    expect(observed.output).toEqual([{ stream: "stdout", text: 'List of 1\n $ path: chr "/"\n' }]);
    await expect(runtime.eval("capture.output(1 + 1, 2 + 2)")).resolves.toEqual(["[1] 2", "[1] 4"]);
    await expect(runtime.eval("capture.output({ 1 + 1; 2 + 2 })")).resolves.toBe("[1] 4");
    await expect(
      runtime.eval('capture.output({ cat("a"); cat("b\\nc"); cat("\\n\\n") })'),
    ).resolves.toEqual(["ab", "c", ""]);
    await expect(runtime.eval("capture.output(invisible(1))")).resolves.toEqual([]);

    const messages = await runtime.evalDetailed(`
      output <- capture.output({ cat("out\\n"); message("public") })
      messages <- capture.output({ cat("visible\\n"); message("captured") }, type = "m")
      list(output, messages)
    `);
    expect(messages.value).toEqual(["out", "captured"]);
    expect(messages.output).toEqual([
      { stream: "message", text: "public\n" },
      { stream: "stdout", text: "visible\n" },
    ]);
    const split = await runtime.evalDetailed('capture.output(cat("copy\\n"), split = TRUE)');
    expect(split.value).toBe("copy");
    expect(split.output).toEqual([{ stream: "stdout", text: "copy\n" }]);
    await expect(runtime.eval('capture.output(capture.output(cat("inner\\n")))')).resolves.toBe(
      '[1] "inner"',
    );
    await expect(runtime.eval("utils::capture.output(1)")).resolves.toBe("[1] 1");

    await expect(runtime.eval('capture.output(1, file = "capture.txt")')).rejects.toMatchObject({
      code: "NRU6156",
    });
    await expect(runtime.eval('capture.output(1, type = "invalid")')).rejects.toMatchObject({
      code: "NRT3342",
    });
    await expect(
      runtime.eval('capture.output(message("x"), type = "message", split = TRUE)'),
    ).rejects.toMatchObject({ code: "NRT3342" });
    await expect(runtime.eval("capture.output(, 1)")).rejects.toMatchObject({
      code: "NRE2103",
    });
    await expect(
      runtime.eval("capture.output(1, split = TRUE, split = FALSE)"),
    ).rejects.toMatchObject({ code: "NRE2102" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxOutputBytes: 5 },
    });
    await expect(limited.eval('capture.output(cat("123456"))')).rejects.toMatchObject({
      code: "NRL4007",
    });
    await limited.dispose();
  });

  it("reports an empty browser demo catalog and rejects external package scripts", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(`
        catalog <- utils::demo(package = character())
        c(
          class(catalog),
          names(catalog),
          dim(catalog$results),
          dimnames(catalog$results)[[2]],
          is.null(catalog$header),
          is.null(catalog$footer)
        )
      `),
    ).resolves.toEqual([
      "packageIQR",
      "title",
      "header",
      "results",
      "footer",
      "0",
      "4",
      "Package",
      "LibPath",
      "Item",
      "Title",
      "TRUE",
      "TRUE",
    ]);
    await expect(runtime.eval('demo("echo", package = "httpuv")')).rejects.toMatchObject({
      code: "NRU6157",
    });
    await expect(runtime.eval('demo(package = "httpuv")')).rejects.toMatchObject({
      code: "NRU6157",
    });
    await expect(runtime.eval('demo(lib.loc = "library")')).rejects.toMatchObject({
      code: "NRU6157",
    });
    await expect(runtime.eval("demo(package = 1)")).rejects.toMatchObject({ code: "NRT3343" });
    await expect(runtime.eval("demo(package = character(), extra = 1)")).rejects.toMatchObject({
      code: "NRE2101",
    });
    await runtime.dispose();
  });

  it("extracts usage-ranked browser regex match objects and inverse gaps", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "m <- regexpr('a+', c('caaab', 'x', NA))\nc(m, attr(m, 'match.length'), attr(m, 'index.type'))",
      ),
    ).resolves.toEqual(["2", "-1", NA, "3", "-1", NA, "chars"]);
    await expect(
      runtime.eval(
        "x <- c(one = 'caaabaa', two = 'x', three = NA)\nm <- gregexpr('a+', x)\ny <- regmatches(x, m)\nc(m[[1]], attr(m[[1]], 'match.length'), lengths(y), y[[1]])",
      ),
    ).resolves.toEqual(["2", "6", "3", "2", "2", "0", "0", "aaa", "aa"]);
    await expect(
      runtime.eval(
        "x <- c(one = 'ba', two = '', three = NA)\nm <- gregexpr('a*', x)\ny <- regmatches(x, m, invert = TRUE)\nc(m[[1]], attr(m[[1]], 'match.length'), y[[1]], y[[2]], is.na(y[[3]]), names(y))",
      ),
    ).resolves.toEqual(["1", "2", "0", "1", "", "b", "", "", "TRUE", "one", "two", "three"]);
    await expect(
      runtime.eval("m <- gregexpr('.', 'é🙂')\nc(m[[1]], attr(m[[1]], 'match.length'))"),
    ).resolves.toEqual([1, 2, 1, 1]);
    await expect(runtime.evalDetailed("regexpr(c('a', 'b'), 'ab')")).resolves.toMatchObject({
      value: 1,
      warnings: [{ code: "NRW1019" }],
    });
    await expect(runtime.eval("gregexpr('a', 'a', useBytes = TRUE)")).rejects.toMatchObject({
      code: "NRU6142",
    });
    await expect(runtime.eval("regmatches('abc', 1L)")).rejects.toMatchObject({
      code: "NRT3256",
    });
    await runtime.dispose();
  });

  it("trims usage-ranked whitespace with direction, patterns, coercion, and attributes", async () => {
    const runtime = await session();
    await expect(runtime.eval("trimws(c(' a ', '\\tb\\n', '\\r\\n', '', NA))")).resolves.toEqual([
      "a",
      "b",
      "",
      "",
      NA,
    ]);
    await expect(
      runtime.eval(
        "c(trimws('  a  ', 'left'), trimws('  a  ', 'right'), trimws('  a  ', 'both'), trimws('  a  ', 'l'))",
      ),
    ).resolves.toEqual(["a  ", "  a", "a", "a  "]);
    await expect(
      runtime.eval("trimws(c('--a--', 'xyabxy'), whitespace = '[-xy]')"),
    ).resolves.toEqual(["a", "ab"]);
    await expect(
      runtime.eval(
        "x <- structure(c(a = ' x ', b = ' y '), tag = 'z')\ny <- trimws(x)\nc(y, names(y), attr(y, 'tag'))",
      ),
    ).resolves.toEqual(["x", "y", "a", "b", "z"]);
    await expect(
      runtime.eval("c(trimws(c(1, NA, 3)), trimws(list(' a ', 'b ')))"),
    ).resolves.toEqual(["1", NA, "3", "a", "b"]);
    await expect(
      runtime.evalDetailed("trimws(' a ', whitespace = c(' ', '-'))"),
    ).resolves.toMatchObject({
      value: "a",
      warnings: [{ code: "NRW1019" }, { code: "NRW1019" }],
    });
    await expect(runtime.eval("trimws(' a ', 'middle')")).rejects.toMatchObject({
      code: "NRT3257",
    });
    await runtime.dispose();
  });

  it("implements quantiles, covariance, summaries, and contingency tables", async () => {
    const runtime = await session();
    await expect(runtime.eval("quantile(1:4, c(0.25, 0.5, 0.75))")).resolves.toEqual([
      1.75, 2.5, 3.25,
    ]);
    await expect(runtime.eval("cov(1:3, 2:4)")).resolves.toBe(1);
    await expect(runtime.eval("cor(1:3, c(2, 4, 6))")).resolves.toBe(1);
    await expect(runtime.eval('cov(c(1, NA, 3), c(2, 4, 6), use = "complete.obs")')).resolves.toBe(
      4,
    );
    await expect(runtime.eval("summary(1:4)")).resolves.toEqual([1, 1.75, 2.5, 2.5, 3.25, 4]);
    await expect(runtime.eval('table(c("a", "b", "a"))')).resolves.toEqual([2, 1]);
    await expect(runtime.eval('dim(table(c("a", "b", "a"), c("x", "x", "y")))')).resolves.toEqual([
      2, 2,
    ]);
    await expect(runtime.eval('prop.table(table(c("a", "b", "a")))')).resolves.toEqual([
      2 / 3,
      1 / 3,
    ]);
    await expect(
      runtime.eval('prop.table(table(c("a", "a", "b", "b"), c("x", "y", "x", "x")), margin = 1)'),
    ).resolves.toEqual([0.5, 1, 0.5, 0]);
    await runtime.dispose();
  });

  it("provides every measured random-distribution constructor", async () => {
    const runtime = await session();
    await expect(runtime.eval("set.seed(1)\nrbinom(4, size = 3, prob = 0)")).resolves.toEqual([
      0, 0, 0, 0,
    ]);
    await expect(runtime.eval("set.seed(1)\nrbinom(4, size = 3, prob = 1)")).resolves.toEqual([
      3, 3, 3, 3,
    ]);
    await expect(runtime.eval("rpois(3, lambda = 0)")).resolves.toEqual([0, 0, 0]);
    await expect(runtime.eval("set.seed(3)\nlength(rchisq(5, df = 4))")).resolves.toBe(5);
    await expect(runtime.eval("set.seed(3)\nlength(rt(5, df = 10))")).resolves.toBe(5);
    await expect(runtime.eval("set.seed(3)\nlength(rexp(5, rate = 2))")).resolves.toBe(5);
    await expect(
      runtime.eval("set.seed(9)\nx <- rpois(4, 20)\nset.seed(9)\nx == rpois(4, 20)"),
    ).resolves.toEqual([true, true, true, true]);
    await expect(runtime.eval("rbinom(1, size = -1, prob = 0.5)")).rejects.toMatchObject({
      code: "NRT3170",
    });
    await expect(
      runtime.eval("set.seed(2)\nsample(1:3, 5, replace = TRUE, prob = c(0, 0, 1))"),
    ).resolves.toEqual([3, 3, 3, 3, 3]);
    await expect(
      runtime.eval("set.seed(2)\nsort(sample(1:3, 2, prob = c(1, 0, 1)))"),
    ).resolves.toEqual([1, 3]);
    await runtime.dispose();
  });

  it("dispatches S3 methods and constructs the measured S4, R6, and vctrs subsets", async () => {
    const runtime = await session();
    await runtime.eval(`
      describe <- function(x) UseMethod("describe")
      describe.score <- function(x) sum(x)
      describe.default <- function(x) -1
      x <- structure(1:3, class = c("score", "numeric"))
    `);
    await expect(runtime.eval("describe(x)")).resolves.toBe(6);
    await expect(runtime.eval("describe(10)")).resolves.toBe(-1);
    await runtime.eval(`
      chained <- function(x) UseMethod("chained")
      chained.score <- function(x) NextMethod()
      chained.numeric <- function(x) sum(x)
      NULL
    `);
    await expect(runtime.eval("chained(x)")).resolves.toBe(6);

    await runtime.eval(`
      setClass("Person")
      setGeneric("label", function(x) "fallback")
      setMethod("label", "Person", function(x) "person")
      person <- new("Person", name = "Ada")
    `);
    await expect(runtime.eval("label(person)")).resolves.toBe("person");
    await expect(runtime.eval("person$name")).resolves.toBe("Ada");
    await expect(runtime.eval('inherits(person, "Person")')).resolves.toBe(true);

    await runtime.eval(`
      setClass("S7Example")
      methods::setGeneric("S4_generic", function(x, suffix = "!") {
        standardGeneric("S4_generic")
      })
      setMethod("S4_generic", "S7Example", function(x, suffix = "!") paste0("Hello", suffix))
      s7_example <- new("S7Example")
    `);
    await expect(runtime.eval('S4_generic(s7_example, "?")')).resolves.toBe("Hello?");
    await expect(runtime.eval('standardGeneric("S4_generic")')).rejects.toMatchObject({
      code: "NRE2126",
    });
    await runtime.eval('setGeneric("S4_missing", function(x) standardGeneric("S4_missing"))\nNULL');
    await expect(runtime.eval("S4_missing(1)")).rejects.toMatchObject({ code: "NRE2125" });

    await runtime.eval(
      'Box <- R6Class("Box", public = list(value = 1))\nbox <- Box$new(value = 3)',
    );
    await expect(runtime.eval("box$value")).resolves.toBe(3);
    await expect(runtime.eval('inherits(box, "Box")')).resolves.toBe(true);
    await expect(runtime.eval('inherits(new_class("score"), "vctrs_class")')).resolves.toBe(true);
    await expect(
      runtime.eval('inherits(new_vctr(1:3, class = "score_vctr"), "score_vctr")'),
    ).resolves.toBe(true);
    await runtime.dispose();
  });

  it("implements the complete measured apply/map family surface", async () => {
    const runtime = await session();
    await expect(runtime.eval("sapply(1:3, function(x) x ^ 2)")).resolves.toEqual([1, 4, 9]);
    await expect(runtime.eval("vapply(1:3, function(x) x ^ 2, 0)")).resolves.toEqual([1, 4, 9]);
    await expect(runtime.eval("mapply(function(x, y) x + y, 1:3, 10:12)")).resolves.toEqual([
      11, 13, 15,
    ]);
    await expect(runtime.eval("Map(function(x, y) x + y, 1:3, 10:12)")).resolves.toEqual([
      11, 13, 15,
    ]);
    await expect(runtime.eval("Reduce(function(x, y) x + y, 1:4)")).resolves.toBe(10);
    await expect(
      runtime.eval("Reduce(function(x, y) x + y, 1:4, accumulate = TRUE)"),
    ).resolves.toEqual([1, 3, 6, 10]);
    await expect(runtime.eval("Filter(function(x) x > 2, 1:4)")).resolves.toEqual([3, 4]);
    await expect(runtime.eval("apply(matrix(1:6, nrow = 2), 1, sum)")).resolves.toEqual([9, 12]);
    await expect(runtime.eval('by(1:4, c("a", "a", "b", "b"), mean)')).resolves.toEqual([1.5, 3.5]);
    await expect(
      runtime.eval('aggregate(1:4, list(c("a", "a", "b", "b")), mean)$x'),
    ).resolves.toEqual([1.5, 3.5]);
    await runtime.dispose();
  });

  it("applies zoo's usage-ranked ragged-array grouping path", async () => {
    const runtime = await session();
    await runtime.eval(`
      x <- 1:6
      screens <- factor(c(1, 1, 2, 2, 3, 3))
      f <- function(idx) range(idx)
      ranges <- tapply(x, screens, f)
    `);
    await expect(runtime.eval("unlist(ranges)")).resolves.toEqual([1, 2, 3, 4, 5, 6]);
    await expect(runtime.eval("c(dim(ranges), unlist(dimnames(ranges)))")).resolves.toEqual([
      "3",
      "1",
      "2",
      "3",
    ]);

    await expect(
      runtime.eval(`
        a <- factor(c("a", "a", "b", "b", "a", "a", "b", "b"), levels = c("a", "b"))
        b <- factor(c("x", "y", "x", "y", "x", "y", "x", "y"), levels = c("x", "y", "z"))
        grouped <- tapply(1:8, list(row = a, col = b), sum)
        c(grouped, dim(grouped), unlist(dimnames(grouped)), names(dimnames(grouped)))
      `),
    ).resolves.toEqual([
      "6",
      "10",
      "8",
      "12",
      NA,
      NA,
      "2",
      "3",
      "a",
      "b",
      "x",
      "y",
      "z",
      "row",
      "col",
    ]);
    await expect(
      runtime.eval(`
        g <- factor(c("b", "a", "b", "a"), levels = c("a", "b", "c"))
        c(tapply(1:4, g, mean, default = "x"),
          unlist(tapply(1:4, g, range, simplify = FALSE)),
          is.null(tapply(1:4, g, range, simplify = FALSE)[[3]]))
      `),
    ).resolves.toEqual(["3", "2", "x", "2", "4", "1", "3", "TRUE"]);
    await expect(
      runtime.eval(`
        ids <- tapply(1:5, factor(c("b", "a", NA, "b", "c"),
          levels = c("a", "b", "c", "d")), FUN = NULL)
        means <- tapply(c(1, NA, 3, 4), c("a", "a", "b", "b"), "mean", na.rm = TRUE)
        c(ids, means)
      `),
    ).resolves.toEqual([2, 1, NA, 2, 3, 1, 3.5]);
    await expect(runtime.eval("tapply(1:3, c('a', 'b'), sum)")).rejects.toMatchObject({
      code: "NRE2144",
    });
    await expect(runtime.eval("tapply(integer(), list(), sum)")).rejects.toMatchObject({
      code: "NRE2143",
    });
    await expect(
      runtime.eval("tapply(1:2, factor(c('a', 'b')), sum, default = 8:9)"),
    ).rejects.toMatchObject({ code: "NRT3338" });
    await runtime.dispose();

    const limited = await createR({
      execution: "inline",
      assets,
      limits: { maxVectorLength: 32 },
    });
    await expect(
      limited.eval("tapply(1, list(factor(1, levels = 1:8), factor(1, levels = 1:8)), sum)"),
    ).rejects.toMatchObject({ code: "NRL4002" });
    await limited.dispose();
  });

  it("parses explicit UTC date-time formats with strptime", async () => {
    const runtime = await session();
    await expect(
      runtime.eval('strptime("1970/01/02 12:30:00", "%Y/%m/%d %H:%M:%S", tz = "UTC")'),
    ).resolves.toBe(131_400);
    await expect(runtime.eval('strptime(c("1970-01-01", "bad"), "%Y-%m-%d")')).resolves.toEqual([
      0,
      NA,
    ]);
    await expect(
      runtime.eval('strptime("2024-01-01", "%Y-%m-%d", tz = "America/New_York")'),
    ).rejects.toMatchObject({ code: "NRU6120" });
    await runtime.dispose();
  });

  it("formats usage-ranked UTC timestamps with strftime", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'strftime(as.POSIXct("2024-02-03 04:05:06", tz = "UTC"), " [%F %T] ", tz = "UTC")',
      ),
    ).resolves.toBe(" [2024-02-03 04:05:06] ");
    await expect(
      runtime.eval('strftime(as.Date("2024-02-03"), c("%F", "%Y"), tz = "UTC")'),
    ).resolves.toEqual(["2024-02-03", "2024"]);
    await expect(
      runtime.eval(`
        strftime(
          as.POSIXlt("2024-02-03 04:05:06", tz = "UTC"),
          c(
            "%a", "%A", "%b", "%B", "%C", "%d", "%e", "%j", "%u", "%w",
            "%U", "%W", "%p", "%I", "%R", "%D", "%x", "%X", "%c", "%z",
            "%Z", "%s", "%%"
          ),
          tz = "UTC"
        )
      `),
    ).resolves.toEqual([
      "Sat",
      "Saturday",
      "Feb",
      "February",
      "20",
      "03",
      " 3",
      "034",
      "6",
      "6",
      "04",
      "05",
      "AM",
      "04",
      "04:05",
      "02/03/24",
      "02/03/24",
      "04:05:06",
      "Sat Feb  3 04:05:06 2024",
      "+0000",
      "UTC",
      "1706933106",
      "%",
    ]);
    await expect(
      runtime.eval('strftime(ISOdate(2024, 2, 3, 4, 5, 6.789, tz = "UTC"), "%OS3", tz = "UTC")'),
    ).resolves.toBe("06.789");
    await expect(
      runtime.eval(
        'strftime(ISOdate(2024, 2, 3, 4, 5, 6.789, tz = "UTC"), "%OS", tz = "UTC", digits = 3)',
      ),
    ).resolves.toBe("06.789");
    await expect(runtime.eval('strftime(as.Date("2024-02-03"), tz = "UTC")')).resolves.toBe(
      "2024-02-03",
    );
    await expect(
      runtime.eval('strftime(as.POSIXct("2024-02-03 04:05:06", tz = "UTC"), tz = "UTC")'),
    ).resolves.toBe("2024-02-03 04:05:06");
    await expect(
      runtime.eval(
        'strftime(as.POSIXct("2024-02-03 00:00:00", tz = "UTC"), tz = "UTC", usetz = TRUE)',
      ),
    ).resolves.toBe("2024-02-03 UTC");
    await expect(
      runtime.eval(
        'named <- strftime(structure(c(0, 86400), names = c("first", "second")), "%F", tz = "UTC"); c(named, names(named))',
      ),
    ).resolves.toEqual(["1970-01-01", "1970-01-02", "first", "second"]);
    await expect(
      runtime.eval('strftime(c(-Inf, Inf, NaN, NA_real_), "%F", tz = "UTC")'),
    ).resolves.toEqual(["-Inf", "Inf", "NaN", NA]);
    await runtime.eval(`
      as.POSIXlt.stamp <- function(x, tz, ...) as.POSIXlt(unclass(x), tz = tz)
      stamp <- structure(0, class = "stamp")
    `);
    await expect(runtime.eval('strftime(stamp, "%F", tz = "UTC")')).resolves.toBe("1970-01-01");
    await expect(runtime.eval('strftime(NULL, "%F", tz = "UTC")')).resolves.toEqual([]);
    await expect(runtime.eval('strftime(0, character(), tz = "UTC")')).rejects.toMatchObject({
      code: "NRT3330",
    });
    await expect(runtime.eval('strftime(0, "%F", tz = "America/New_York")')).rejects.toMatchObject({
      code: "NRU6154",
    });
    await expect(runtime.eval('strftime(0, "%V", tz = "UTC")')).rejects.toMatchObject({
      code: "NRU6155",
    });
    await expect(runtime.eval('strftime(0, "%F", tz = "UTC", usetz = NA)')).rejects.toMatchObject({
      code: "NRT3103",
    });
    await expect(
      runtime.eval('strftime(0, paste(rep("时", 683), collapse = ""), tz = "UTC")'),
    ).rejects.toMatchObject({ code: "NRL4017" });
    await runtime.dispose();
  });

  it("constructs strict tibble and formula-header tribble subsets", async () => {
    const runtime = await session();
    await runtime.eval('tbl <- tibble(x = 1:2, label = c("a", "b"))');
    await expect(runtime.eval("class(tbl)")).resolves.toEqual(["tbl_df", "tbl", "data.frame"]);
    await expect(runtime.eval("tbl$x")).resolves.toEqual([1, 2]);
    await runtime.eval('rows <- tribble(~x, ~label, 1, "a", 2, "b")');
    await expect(runtime.eval("names(rows)")).resolves.toEqual(["x", "label"]);
    await expect(runtime.eval("rows$x")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("rows$label")).resolves.toEqual(["a", "b"]);
    await runtime.dispose();
  });

  it("subsets and replaces matrices and data frames in two dimensions", async () => {
    const runtime = await session();
    await runtime.eval(
      'm <- matrix(1:6, nrow = 2, dimnames = list(c("r1", "r2"), c("c1", "c2", "c3")))',
    );
    await expect(runtime.eval("m[1, ]")).resolves.toEqual([1, 3, 5]);
    await expect(runtime.eval("m[, 2]")).resolves.toEqual([3, 4]);
    await expect(runtime.eval("m[1, 2]")).resolves.toBe(3);
    await expect(runtime.eval('m["r2", "c3"]')).resolves.toBe(6);
    await expect(runtime.evalRaw("m[1, , drop = FALSE]")).resolves.toMatchObject({
      dim: [1, 3],
    });
    await runtime.eval("m[1, 2] <- 30");
    await expect(runtime.eval("m[1, 2]")).resolves.toBe(30);
    await expect(runtime.eval("m[-1, 1]")).resolves.toBe(2);

    await runtime.eval('df <- data.frame(x = 1:3, label = c("a", "b", "c"))');
    await expect(runtime.eval("df[1:2, 1]")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("dim(df[1, ])")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("df[2:3, 2]")).resolves.toEqual(["b", "c"]);
    await runtime.eval("df[2, 1] <- 20");
    await expect(runtime.eval("df$x")).resolves.toEqual([1, 20, 3]);
    await expect(runtime.eval("c(10, 20, 30)[-2]")).resolves.toEqual([10, 30]);
    await expect(runtime.eval("c(10, 20, 30)[c(0, 2)]")).resolves.toBe(20);
    await runtime.dispose();
  });

  it("quotes and evaluates normalized language without JavaScript code generation", async () => {
    const runtime = await session();
    await expect(runtime.eval("x <- 4\neval(quote(x + 1))")).resolves.toBe(5);
    await expect(runtime.eval("x <- 7\neval(quote(x))")).resolves.toBe(7);
    await expect(runtime.eval("eval(quote(2L))")).resolves.toBe(2);
    await expect(runtime.eval("quote(alpha)")).resolves.toEqual({
      __nativr__: "symbol",
      name: "alpha",
    });
    await expect(runtime.eval("quote(1 + alpha)")).resolves.toEqual({
      __nativr__: "language",
      source: "(1 + alpha)",
    });
    await expect(
      runtime.eval(
        "c(typeof(quote(alpha)), mode(quote(alpha)), typeof(quote(alpha + 1)), mode(quote(alpha + 1)), typeof(quote))",
      ),
    ).resolves.toEqual(["symbol", "name", "language", "call", "special"]);
    await expect(
      runtime.eval(
        "c(is.symbol(quote(alpha)), is.name(quote(alpha)), is.language(quote(alpha)), is.call(quote(alpha + 1)), is.recursive(quote(alpha + 1)))",
      ),
    ).resolves.toEqual([true, true, true, true, true]);
    await expect(
      runtime.eval(
        "x <- 4\nexplicit <- new.env(parent = baseenv())\nexplicit$x <- 4\nf <- function() { y <- 3; c(evalq(x + y), evalq(x * 3, envir = explicit), evalq(x + y, NULL)) }\nf()",
      ),
    ).resolves.toEqual([7, 12, 7]);
    await expect(
      runtime.eval(
        "tracker <- 0\ne <- new.env(parent = baseenv())\ne$x <- 9\nvalue <- evalq({ tracker <- 1; x <- x + 2; x }, e)\nc(value, e$x, tracker, e$tracker)",
      ),
    ).resolves.toEqual([11, 11, 0, 1]);
    await expect(
      runtime.eval(
        "y <- 10\nenclos <- list2env(list(y = 3), parent = baseenv())\nc(evalq(x + y, list(x = 2)), evalq(x + y, pairlist(x = 2), enclos), evalq(x + y, data.frame(x = 1:2), enclos), eval(quote(x + y), list(x = 2), enclos))",
      ),
    ).resolves.toEqual([12, 5, 4, 5, 5]);
    await expect(runtime.evalDetailed("evalq(invisible(3))")).resolves.toMatchObject({
      value: 3,
      visible: false,
    });
    await expect(runtime.eval("eval()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("evalq()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("eval(quote(1), envir = 1)")).rejects.toMatchObject({
      code: "NRT3205",
    });
    await expect(runtime.eval("evalq(1, envir = 1)")).rejects.toMatchObject({
      code: "NRT3205",
    });
    await expect(runtime.eval("evalq(1, envir = list(), enclos = 1)")).rejects.toMatchObject({
      code: "NRT3205",
    });
    await expect(
      runtime.eval(
        "inner <- function(x) c(deparse1(sys.call()), deparse1(sys.call(-1)), deparse1(sys.call(1)), deparse1(sys.call(2)), is.null(sys.call(-2)))\nouter <- function() inner(1 + 2)\nouter()",
      ),
    ).resolves.toEqual(["inner((1 + 2))", "outer()", "outer()", "inner((1 + 2))", "TRUE"]);
    await expect(runtime.eval("is.null(sys.call())")).resolves.toBe(true);
    await expect(
      runtime.eval(
        "f <- function() c(deparse1(sys.call(1.9)), deparse1(sys.call('1')), deparse1(sys.call(c(1, 2))))\nf()",
      ),
    ).resolves.toEqual(["f()", "f()", "f()"]);
    await expect(
      runtime.eval(
        "inner <- function(x) identical(sys.call(TRUE), quote(outer()))\nouter <- function() inner(1 + 2)\nouter()",
      ),
    ).resolves.toBe(true);
    const complexFrame = await runtime.evalDetailed(
      "inner <- function() identical(sys.call(1 + 2i), quote(inner()))\ninner()",
    );
    expect(complexFrame.value).toBe(true);
    expect(complexFrame.warnings).toMatchObject([{ code: "NRW1005" }]);
    const invalidCharacterFrame = await runtime.evalDetailed(
      'inner <- function() try(sys.call("not-a-frame"), silent = TRUE)\ninner()',
    );
    expect(invalidCharacterFrame.warnings).toMatchObject([{ code: "NRW1006" }]);
    const infiniteFrame = await runtime.evalDetailed(
      "inner <- function() try(sys.call(Inf), silent = TRUE)\ninner()",
    );
    expect(infiniteFrame.warnings).toMatchObject([{ code: "NRW1007" }]);
    await expect(runtime.eval("f <- function() sys.call(2)\nf()")).rejects.toMatchObject({
      code: "NRE2218",
    });
    await expect(runtime.eval("f <- function() sys.call(NA)\nf()")).rejects.toMatchObject({
      code: "NRT3251",
    });
    await runtime.dispose();
  });

  it("constructs expression vectors and calls on the owned language model", async () => {
    const runtime = await session();
    await expect(runtime.eval("expression()")).resolves.toEqual({
      __nativr__: "expression",
      sources: [],
    });
    await expect(runtime.eval("eval(expression())")).resolves.toBeNull();
    await expect(runtime.eval("expression(x, 1 + y)")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["x", "(1 + y)"],
    });
    await expect(runtime.eval("x <- 4\ny <- 2\neval(expression(x, 1 + y))")).resolves.toBe(3);
    await expect(runtime.eval("eval(expression(answer = 42))\nanswer")).resolves.toBe(42);
    await expect(
      runtime.eval(
        "e <- expression(x, 1 + y)\nc(typeof(e), mode(e), length(e), lengths(e), is.expression(e), is.language(e), is.vector(e), is.recursive(e))",
      ),
    ).resolves.toEqual(["expression", "expression", "2", "1", "3", "TRUE", "TRUE", "TRUE", "TRUE"]);
    await expect(runtime.eval('vector("expression", 2)')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["NULL", "NULL"],
    });
    await expect(runtime.eval('as.name("alpha")')).resolves.toEqual({
      __nativr__: "symbol",
      name: "alpha",
    });
    await expect(runtime.eval("as.expression(NULL)")).resolves.toEqual({
      __nativr__: "expression",
      sources: [],
    });
    await expect(runtime.eval("as.expression(1:2)")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["1L", "2L"],
    });
    await expect(runtime.eval("as.expression(expression(x))")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["x"],
    });
    await expect(runtime.eval("as.expression(quote(x))")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["x"],
    });
    await expect(runtime.eval("x <- 9\neval(as.expression(list(quote(x), 1L)))")).resolves.toBe(1);
    await expect(runtime.eval('eval(call("sum", 1:3))')).resolves.toBe(6);
    await expect(runtime.eval('eval(call(na = "sum", 1:3))')).resolves.toBe(6);
    await expect(runtime.eval("eval(call(quote(sum), 1:3))")).resolves.toBe(6);
    await expect(runtime.eval('eval(as.call(list(as.name("sum"), 1, 2)))')).resolves.toBe(3);
    await expect(runtime.eval("eval(as.call(expression(sum, 1, 2)))")).resolves.toBe(3);
    await expect(runtime.eval('eval(as.call(expression("sum", 1, 2)))')).resolves.toBe(3);
    await expect(runtime.eval('eval(call("+", 1, 2))')).resolves.toBe(3);
    await expect(runtime.eval('eval(call("-", 4))')).resolves.toBe(-4);
    await expect(runtime.eval('eval(call(":", 1, 3))')).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval('eval(call("%in%", c(1, 3), 1:2))')).resolves.toEqual([true, false]);
    await expect(runtime.eval('eval(as.call(list(as.name("+"), 1, 2)))')).resolves.toBe(3);
    await expect(runtime.eval("typeof(`+`)")).resolves.toBe("builtin");
    await expect(runtime.eval('deparse(call("f", 1, x = 2))')).resolves.toBe("f(1, x = 2)");
    await expect(runtime.eval("deparse(expression(x, 1 + y))")).resolves.toBe(
      "expression(x, (1 + y))",
    );
    await expect(runtime.eval("deparse(quote(x))")).resolves.toBe("x");
    await expect(runtime.eval("deparse(1:2)")).resolves.toBe("c(1L, 2L)");
    await expect(runtime.eval("deparse(list(a = 1))")).resolves.toBe("list(a = 1)");
    await expect(runtime.eval("deparse(1 + 2i)")).resolves.toBe("(1 + 2i)");
    await expect(runtime.eval("deparse(as.raw(1))")).resolves.toBe("as.raw(1L)");
    await expect(runtime.eval('deparse(call("identity", list(a = 1)))')).resolves.toBe(
      "identity(list(a = 1))",
    );
    await expect(runtime.eval("call(x = 1)")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval('call(name = "sum", name = "sum")')).rejects.toMatchObject({
      code: "NRE2102",
    });
    await expect(runtime.eval("call(1)")).rejects.toMatchObject({ code: "NRT3208" });
    await expect(runtime.eval('eval(call("*", 1))')).rejects.toMatchObject({ code: "NRE2140" });
    await expect(runtime.eval("as.call(list())")).rejects.toMatchObject({ code: "NRT3208" });
    await expect(runtime.eval("as.call(expression(1, 2))")).rejects.toMatchObject({
      code: "NRT3208",
    });
    await expect(runtime.eval("deparse(function(x) x)")).rejects.toMatchObject({
      code: "NRT3209",
    });
    await expect(runtime.eval('as.name("")')).rejects.toMatchObject({ code: "NRT3207" });
    await runtime.dispose();
  });

  it("parses character vectors into owned expression vectors with bounded n semantics", async () => {
    const runtime = await session();
    await expect(runtime.eval('parse(text = "x <- 1; x + 2")')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["(x <- 1)", "(x + 2)"],
    });
    await expect(runtime.eval('eval(parse(text = c("x <- 4", "x + 2")))')).resolves.toBe(6);
    await expect(runtime.eval('parse(text = c("1 +", "2"))')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["(1 + 2)"],
    });
    await expect(runtime.eval('parse(text = "1; x +", n = 1)')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["1"],
    });
    await expect(runtime.eval('parse(text = "x +", n = 0)')).resolves.toEqual({
      __nativr__: "expression",
      sources: [],
    });
    await expect(runtime.eval("parse(text = NA_character_)")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["NA"],
    });
    await expect(runtime.eval("parse(text = 1)")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["1"],
    });
    await expect(runtime.eval('parse(text = "1 +")')).rejects.toMatchObject({ code: "NRP1002" });
    await expect(runtime.eval('parse(file = "script.R")')).rejects.toMatchObject({
      code: "NRU6133",
    });
    await expect(runtime.eval('parse(text = "1", keep.source = TRUE)')).rejects.toMatchObject({
      code: "NRU6134",
    });
    await runtime.dispose();
  });

  it("parses usage-ranked strings into owned expressions and language values", async () => {
    const runtime = await session();
    await expect(runtime.eval('str2expression("x[3] <- 1+4")')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["(x[3] <- (1 + 4))"],
    });
    await expect(runtime.eval('str2expression(c("# a comment", "", "42"))')).resolves.toEqual({
      __nativr__: "expression",
      sources: ["42"],
    });
    await expect(runtime.eval('eval(str2expression(c("x <- 1", "x + 2")))')).resolves.toBe(3);
    await expect(
      runtime.eval('x <- c(0, 0, 0); eval(str2lang("x[3] <- 1+4")); x'),
    ).resolves.toEqual([0, 0, 5]);
    await expect(runtime.eval('str2lang("abc")')).resolves.toEqual({
      __nativr__: "symbol",
      name: "abc",
    });
    await expect(runtime.eval('str2lang("1L")')).resolves.toBe(1);
    await expect(runtime.eval("str2lang(NA_character_)")).resolves.toEqual({
      __nativr__: "NA",
    });
    await expect(runtime.eval('str2lang("x; y")')).rejects.toMatchObject({ code: "NRE2159" });
    await expect(runtime.eval('str2lang("")')).rejects.toMatchObject({ code: "NRE2159" });
    await expect(runtime.eval("str2lang(c('x', 'y'))")).rejects.toMatchObject({ code: "NRT3301" });
    await expect(runtime.eval("str2expression(1)")).rejects.toMatchObject({ code: "NRT3300" });
    await runtime.dispose();
  });

  it("decodes the usage-ranked URL path without host or network access", async () => {
    const runtime = await session();
    await expect(runtime.eval('URLdecode("ab%20cd")')).resolves.toBe("ab cd");
    await expect(
      runtime.eval(
        'c(URLdecode(c("a+b", "%2F", "%3f", "x%20y")), utils::URLdecode(c("%E2%82%AC", "caf%C3%A9", "%F0%9F%98%80")))',
      ),
    ).resolves.toEqual(["a+b", "/", "?", "x y", "€", "café", "😀"]);
    await expect(
      runtime.eval(
        'x <- URLdecode(c(first = NA_character_, empty = "", plain = "abc")); c(x, names(x))',
      ),
    ).resolves.toEqual(["NA", "", "abc"]);
    await expect(runtime.eval("URLdecode(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval('URLdecode("%00tail")')).resolves.toBe("");
    await expect(runtime.eval('URLdecode("%GG")')).rejects.toMatchObject({ code: "NRU6149" });
    await expect(runtime.eval('URLdecode("%FF")')).rejects.toMatchObject({ code: "NRU6150" });
    await expect(runtime.eval("URLdecode(1)")).rejects.toMatchObject({ code: "NRT3302" });
    await runtime.dispose();
  });

  it("constructs the usage-ranked custom warning condition shape", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        'w <- warningCondition("package backports not found"); c(typeof(w), names(w), class(w), conditionMessage(w), is.null(w$call))',
      ),
    ).resolves.toEqual([
      "list",
      "message",
      "call",
      "warning",
      "condition",
      "package backports not found",
      "TRUE",
    ]);
    await expect(
      runtime.eval(
        'w <- warningCondition("warn", code = 42L, detail = "x", class = c("testWarning", "secondary"), call = quote(f(1))); c(names(w), class(w), conditionMessage(w), deparse(w$call), w$code, w$detail)',
      ),
    ).resolves.toEqual([
      "message",
      "call",
      "code",
      "detail",
      "testWarning",
      "secondary",
      "warning",
      "condition",
      "warn",
      "f(1)",
      "42",
      "x",
    ]);
    await expect(
      runtime.eval(
        'w <- suppressWarnings(warningCondition("warning", class = "testWarning"), "testWarning"); c(class(w), conditionMessage(w))',
      ),
    ).resolves.toEqual(["testWarning", "warning", "condition", "warning"]);
    await expect(runtime.eval("conditionMessage(warningCondition(c('a', 'b')))")).resolves.toEqual([
      "a",
      "b",
    ]);
    await expect(
      runtime.eval('warningCondition("warn", class = NA_character_)'),
    ).rejects.toMatchObject({
      code: "NRU6151",
    });
    await runtime.dispose();
  });

  it("round-trips public symbol, language, and expression markers through assign", async () => {
    const runtime = await session();
    await runtime.assign("x", 5);
    await runtime.assign("symbol", { __nativr__: "symbol", name: "x" });
    await runtime.assign("language", { __nativr__: "language", source: "x + 2" });
    await runtime.assign("program", {
      __nativr__: "expression",
      sources: ["y <- x * 2", "y + 1"],
    });
    await expect(runtime.eval("eval(symbol)")).resolves.toBe(5);
    await expect(runtime.eval("eval(language)")).resolves.toBe(7);
    await expect(runtime.eval("eval(program)")).resolves.toBe(11);
    await expect(runtime.get("language")).resolves.toEqual({
      __nativr__: "language",
      source: "(x + 2)",
    });
    await expect(
      runtime.assign("invalid", { __nativr__: "language", source: "1; 2" }),
    ).rejects.toMatchObject({ code: "NRT3206" });
    await runtime.dispose();
  });

  it("substitutes promises, list bindings, and ellipsis without forcing source expressions", async () => {
    const runtime = await session();
    await expect(runtime.eval("x <- 100\nsubstitute(x)")).resolves.toBe(100);
    await expect(runtime.eval("eval(substitute(x + y, list(x = 1, y = 2)))")).resolves.toBe(3);
    await expect(runtime.eval("x <- 10\neval(substitute(x + y, list(y = 1:2)))")).resolves.toEqual([
      11, 12,
    ]);
    await expect(
      runtime.eval("f <- function(x, y = 2 + 3) eval(substitute(x + y))\nf(1 + 2)"),
    ).resolves.toBe(8);
    await expect(
      runtime.eval("f <- function(...) eval(substitute(sum(...)))\nf(1, 2, 3)"),
    ).resolves.toBe(6);
    await expect(
      runtime.eval("f <- function(x) is.symbol(substitute(x))\nf(never_defined)"),
    ).resolves.toBe(true);
    await expect(
      runtime.eval("eval(substitute(quote(x + y), list(x = 1, y = 2)))"),
    ).resolves.toEqual({
      __nativr__: "language",
      source: "(1 + 2)",
    });
    await expect(
      runtime.eval("f <- eval(substitute(function(x) x + y, list(x = 1, y = 2)))\nf(99)"),
    ).resolves.toBe(3);
    await expect(runtime.eval("eval(substitute({ x; y }, list(x = 1, y = 2)))")).resolves.toBe(2);
    await expect(runtime.eval("eval(substitute(-x, list(x = 3)))")).resolves.toBe(-3);
    await expect(runtime.eval("eval(substitute(z <- x, list(x = 2)))\nz")).resolves.toBe(2);
    await expect(
      runtime.eval("z <- c(1, 2)\neval(substitute(z[i] <- value, list(i = 2, value = 9)))\nz"),
    ).resolves.toEqual([1, 9]);
    await expect(
      runtime.eval("eval(substitute(if (flag) yes else no, list(flag = TRUE, yes = 1, no = 2)))"),
    ).resolves.toBe(1);
    await expect(
      runtime.eval(
        "total <- 0\neval(substitute(for (i in xs) total <- total + i, list(xs = 1:3)))\ntotal",
      ),
    ).resolves.toBe(6);
    await expect(
      runtime.eval("i <- 0\neval(substitute(while (i < limit) i <- i + 1, list(limit = 3)))\ni"),
    ).resolves.toBe(3);
    await expect(
      runtime.eval(
        "i <- 0\neval(substitute(repeat { i <- i + step; if (i >= limit) break }, list(step = 2, limit = 4)))\ni",
      ),
    ).resolves.toBe(4);
    await expect(
      runtime.eval("eval(substitute(values[index], list(values = c(10, 20), index = 2)))"),
    ).resolves.toBe(20);
    await expect(
      runtime.eval("eval(substitute(pkg::fun(1:3), list(pkg = quote(base), fun = quote(sum))))"),
    ).resolves.toBe(6);
    await expect(
      runtime.eval("deparse(substitute(y ~ x, list(y = quote(out), x = quote(input))))"),
    ).resolves.toBe("out ~ input");
    await expect(runtime.eval("deparse(substitute(~x, list(x = quote(input))))")).resolves.toBe(
      "~input",
    );
    await expect(
      runtime.eval("eval(substitute(x |> f(), list(x = 1:3, f = quote(sum))))"),
    ).resolves.toBe(6);
    await expect(
      runtime.eval("f <- eval(substitute(function(a = x) a + y, list(x = 2, y = 3)))\nf()"),
    ).resolves.toBe(5);
    await expect(runtime.eval("f <- function(...) is.null(substitute(...))\nf()")).resolves.toBe(
      true,
    );
    await expect(runtime.eval("f <- function(...) eval(substitute(...))\nf(1 + 2)")).resolves.toBe(
      3,
    );
    await expect(
      runtime.eval("f <- function(...) c(typeof(quote(...)), deparse(quote(...)))\nf(1 + 2)"),
    ).resolves.toEqual(["symbol", "..."]);
    await expect(runtime.eval("f <- function(...) expression(...)\nf(1 + 2)")).resolves.toEqual({
      __nativr__: "expression",
      sources: ["..."],
    });
    await expect(runtime.eval("is.symbol(substitute(x, list(1)))")).resolves.toBe(true);
    await expect(runtime.eval("substitute()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("substitute(x, 1)")).rejects.toMatchObject({ code: "NRT3210" });
    await expect(runtime.eval("substitute(e = x, en = list(x = 1))")).rejects.toMatchObject({
      code: "NRE2104",
    });
    await runtime.dispose();
  });

  it("reconstructs canonical closure calls without forcing their arguments", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "f <- function(alpha, beta = 2, ...) deparse(match.call())\nf(al = 1 + 2, z = 4)",
      ),
    ).resolves.toBe("f(alpha = (1 + 2), z = 4)");
    await expect(
      runtime.eval(
        "f <- function(alpha, beta = 2, ...) deparse(match.call(expand.dots = FALSE))\nf(al = 1 + 2, z = 4)",
      ),
    ).resolves.toBe("f(alpha = (1 + 2), ... = pairlist(z = 4))");
    await expect(
      runtime.eval(
        "f <- function(alpha, beta = 2, ...) c(length(as.list(match.call())), names(as.list(match.call())))\nf(al = 1, z = 2)",
      ),
    ).resolves.toEqual(["3", "", "alpha", "z"]);
    await expect(
      runtime.eval(
        "f <- function(x, y = 3) c(length(as.list(match.call())), names(as.list(match.call())))\nf(1)",
      ),
    ).resolves.toEqual(["2", "", "x"]);
    await expect(
      runtime.eval("f <- function(x, y = 3) names(as.list(match.call()))\nf(y = 2, x = 1)"),
    ).resolves.toEqual(["", "x", "y"]);
    await expect(runtime.eval('names(as.list(call("f", 1, x = 2)))')).resolves.toEqual([
      "",
      "",
      "x",
    ]);
    await expect(runtime.eval("match.call()")).rejects.toMatchObject({ code: "NRE2217" });
    await expect(
      runtime.eval("f <- function(x) match.call(definition = x)\nf(1)"),
    ).rejects.toMatchObject({ code: "NRU6131" });
    await runtime.dispose();
  });

  it("creates and traverses explicit lexical evaluation environments", async () => {
    const runtime = await session();
    await expect(runtime.eval("search()")).resolves.toEqual([
      ".GlobalEnv",
      "package:stats",
      "package:graphics",
      "package:grDevices",
      "package:utils",
      "package:datasets",
      "package:methods",
      "Autoloads",
      "package:base",
    ]);
    await expect(runtime.eval("search(1)")).rejects.toMatchObject({ code: "NRE2101" });
    await expect(
      runtime.eval(
        "c(is.environment(globalenv()), is.environment(baseenv()), is.environment(emptyenv()))",
      ),
    ).resolves.toEqual([true, true, true]);
    await expect(
      runtime.eval("x <- 5\ne <- new.env(parent = globalenv())\neval(quote(x), e)"),
    ).resolves.toBe(5);
    await expect(
      runtime.eval(
        "e <- new.env(hash = FALSE, parent = emptyenv(), size = 7)\neval(quote(x <- 8), e)\neval(quote(x), e)",
      ),
    ).resolves.toBe(8);
    await expect(
      runtime.eval("x <- 11\ne <- new.env(parent = globalenv())\neval(quote(x), parent.env(e))"),
    ).resolves.toBe(11);
    await expect(
      runtime.eval("f <- function() { x <- 7; eval(quote(x), environment()) }\nf()"),
    ).resolves.toBe(7);
    await expect(
      runtime.eval("x <- 9\nf <- function() x\neval(quote(x), environment(f))"),
    ).resolves.toBe(9);
    await expect(
      runtime.eval("c(is.environment(environment(mean)), is.null(environment(`+`)))"),
    ).resolves.toEqual([true, true]);
    await runtime.eval("e <- new.env(parent = baseenv())\ne$x <- 1");
    await expect(runtime.eval("e$x")).resolves.toBe(1);
    await expect(runtime.eval('e[["x"]]')).resolves.toBe(1);
    await expect(runtime.eval('get("x", envir = e)')).resolves.toBe(1);
    await expect(
      runtime.eval('get0("definitely.absent", envir = e, ifnotfound = 7)'),
    ).resolves.toBe(7);
    await expect(runtime.eval('exists("x", envir = e)')).resolves.toBe(true);
    await expect(runtime.eval('exists("mean", envir = e, inherits = TRUE)')).resolves.toBe(true);
    await expect(runtime.eval('exists("mean", envir = e, inherits = FALSE)')).resolves.toBe(false);
    await expect(runtime.eval('get("x", envir = e, mode = "numeric")')).resolves.toBe(1);
    await expect(runtime.eval('get0("definitely.absent", envir = e)')).resolves.toBeNull();
    await expect(runtime.eval('exists("mean", envir = e, mode = "function")')).resolves.toBe(true);
    await expect(runtime.eval('exists("mean", envir = e, mode = "numeric")')).resolves.toBe(false);
    await expect(runtime.eval('assign("local", 4, envir = e)\ne$local')).resolves.toBe(4);
    await expect(runtime.eval("list2env(list(extra = 5), envir = e)\ne$extra")).resolves.toBe(5);
    await expect(
      runtime.eval(
        'c(environmentName(e), environmentName(emptyenv()), environmentName(as.environment("base")), environmentName(as.environment(-1)))',
      ),
    ).resolves.toEqual(["", "R_EmptyEnv", "base", "R_GlobalEnv"]);
    await expect(
      runtime.eval(
        'parent <- new.env()\nparent$x <- 1\nchild <- new.env(parent = parent)\nassign("x", 2, envir = child, inherits = TRUE)\nc(parent$x, exists("x", envir = child, inherits = FALSE))',
      ),
    ).resolves.toEqual([2, 0]);
    await expect(
      runtime.eval(
        'e <- list2env(list(a = 3, b = 4), parent = baseenv())\nc(e$a, e[["b"]], environmentName(parent.env(e)), environmentName(as.environment(1)))',
      ),
    ).resolves.toEqual(["3", "4", "base", "R_GlobalEnv"]);
    await expect(
      runtime.eval(
        'e <- new.env()\ne$x <- 1\ndelayedAssign("z", not.bound, assign.env = e)\ntracker <- new.env()\ntracker$n <- 0\nc(get0("x", envir = e, ifnotfound = { tracker$n <- tracker$n + 1; 99 }), exists("z", envir = e), tracker$n)',
      ),
    ).resolves.toEqual([1, 1, 1]);
    await expect(runtime.eval("x <- 10\nis.symbol(substitute(x, globalenv()))")).resolves.toBe(
      true,
    );
    await expect(runtime.eval("new.env(parent = 1)")).rejects.toMatchObject({ code: "NRT3211" });
    await expect(runtime.eval("parent.env(emptyenv())")).rejects.toMatchObject({
      code: "NRE2141",
    });
    await expect(runtime.eval("globalenv(1)")).rejects.toMatchObject({ code: "NRE2101" });
    await expect(runtime.eval('get("definitely.absent", envir = e)')).rejects.toMatchObject({
      code: "NRE2001",
    });
    await expect(runtime.eval('get("x", envir = e, mode = "invalid")')).rejects.toMatchObject({
      code: "NRT3215",
    });
    await expect(runtime.eval("list2env(list(1))")).rejects.toMatchObject({ code: "NRT3215" });
    await expect(runtime.eval("as.environment(2)")).rejects.toMatchObject({ code: "NRT3215" });
    await expect(runtime.eval("environmentName(1)")).rejects.toMatchObject({ code: "NRT3215" });
    await runtime.dispose();
  });

  it("converts environments to lists with local names, ordering, promises, and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "parent <- new.env(parent = emptyenv(), hash = FALSE)\nparent$inherited <- 99L\ne <- new.env(parent = parent, hash = FALSE)\ne$z <- 3L\ne$.hidden <- 4L\ne$a <- 1L\ndefault <- as.list(e)\nsorted <- as.list(e, all.names = TRUE, sorted = TRUE)\nc(identical(names(default), c('a', 'z')), identical(names(sorted), c('.hidden', 'a', 'z')), unlist(sorted), !('inherited' %in% names(sorted)), is.null(attributes(as.list(new.env(parent = emptyenv())))))",
      ),
    ).resolves.toEqual([1, 1, 4, 1, 3, 1, 1]);
    await expect(
      runtime.eval(
        "tracker <- new.env()\ntracker$order <- character()\ne <- new.env(parent = emptyenv(), hash = FALSE)\ndelayedAssign('z', { tracker$order <- c(tracker$order, 'z'); 3L }, assign.env = e)\ndelayedAssign('a', { tracker$order <- c(tracker$order, 'a'); 1L }, assign.env = e)\nresult <- as.list(e, sorted = TRUE)\nc(unlist(result), identical(tracker$order, c('a', 'z')))",
      ),
    ).resolves.toEqual([1, 3, 1]);
    await expect(
      runtime.eval(
        "as.list.probe <- function(x, ...) list(dispatched = TRUE, dots = list(...))\ncustom <- structure(1L, class = 'probe')\nf <- function(...) { converted <- as.list(environment(), all.names = TRUE); c(typeof(converted[['...']]) == '...', length(converted[['...']]) == 2) }\ne <- list2env(list(x = 1L, y = 2L, z = 3L), parent = emptyenv())\nc(as.list(custom, marker = 2L)$dispatched, as.list(custom, marker = 2L)$dots$marker, identical(names(as.list.environment(e)), c('z', 'y', 'x')), f(named = 1L, 2L))",
      ),
    ).resolves.toEqual([1, 2, 1, 1, 1]);
    await expect(
      runtime.eval(
        "e <- new.env(parent = emptyenv())\ndelayedAssign('bad', stop('promise exploded'), assign.env = e)\nas.list(e)",
      ),
    ).rejects.toMatchObject({ message: "promise exploded" });
    await runtime.dispose();
  });

  it("estimates matrix condition numbers through kappa methods and S3 dispatch", async () => {
    const runtime = await session();
    await expect(
      runtime.eval(
        "square <- matrix(c(1, 2, 3, 5), 2)\nc(round(kappa(diag(c(1, 2, 4))), 12), round(kappa(diag(c(1, 2, 4)), exact = TRUE), 12), round(kappa(square), 12), round(kappa(square, exact = TRUE), 12), round(kappa(matrix(1:6, 3, 2)), 12), round(kappa(matrix(1:6, 2, 3)), 12), round(kappa(square, norm = 'I'), 12), round(kappa(square, method = 'direct'), 12))",
      ),
    ).resolves.toEqual([
      3, 4, 47.894736842105, 38.97434209415, 15.557531807477, 21.295631708537, 4.333333333333, 56,
    ]);
    await expect(
      runtime.eval(
        "upper <- matrix(c(1, 0, 0, 2, 3, 0, 4, 5, 6), 3)\nlower <- t(upper)\nc(round(kappa(upper, triangular = TRUE), 12), round(kappa(lower, triangular = TRUE, uplo = 'L'), 12), kappa(1:4), kappa(matrix(numeric(), 0, 0)), kappa(matrix(c(1, 2, 2, 4), 2)))",
      ),
    ).resolves.toEqual([13.571428571429, 10.706285659559, 1, 0, Number.POSITIVE_INFINITY]);
    await expect(
      runtime.eval(
        "kappa.probe <- function(z, ...) 42\ntracker <- new.env()\ntracker$forced <- FALSE\nfit <- lm(c(1, 3, 5, 7) ~ c(0, 1, 2, 3))\nc(kappa(structure(1, class = 'probe')), round(kappa(fit, inv_z = { tracker$forced <- TRUE; stop('forced') }), 12), tracker$forced)",
      ),
    ).resolves.toEqual([42, 4.85410196625, 0]);
    await runtime.dispose();
  });

  it("cross-tabulates usage-ranked formula data through xtabs", async () => {
    const runtime = await session();
    await runtime.eval(
      "dd <- data.frame(f1 = gl(4, 6, labels = c('A', 'B', 'C', 'D')), f2 = gl(3, 2, labels = c('a', 'b', 'c')))[-(7:8), ]\nsampled <- xtabs(~ f2 + f1, dd)",
    );
    await expect(runtime.eval("unclass(sampled)")).resolves.toEqual([
      2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2,
    ]);
    await expect(
      runtime.eval(
        "c(dim(sampled), typeof(sampled), class(sampled), names(dimnames(sampled)), typeof(attr(sampled, 'call')))",
      ),
    ).resolves.toEqual(["3", "4", "integer", "xtabs", "table", "f2", "f1", "language"]);

    await expect(
      runtime.eval(
        "d <- data.frame(g = factor(c('b', 'a', 'b', 'a'), levels = c('b', 'a', 'unused')), h = c('y', 'x', 'x', 'x'), w = c(2, 3, 4, 5))\nweighted <- xtabs(w ~ g + h, d)\ndropped <- xtabs(~ g + h, d, drop.unused.levels = TRUE)\nselected <- xtabs(w ~ g + h, d, subset = w >= 4)\nc(unclass(weighted), dim(dropped), unclass(dropped), dim(selected), unclass(selected))",
      ),
    ).resolves.toEqual([4, 8, 0, 2, 0, 0, 2, 2, 1, 2, 1, 0, 3, 1, 4, 5, 0]);

    await runtime.eval(
      "n <- data.frame(g = factor(c('a', NA, 'b', 'a'), levels = c('a', 'b', 'unused')), h = c('x', 'x', 'y', NA), w = c(1, 2, NA, 4))",
    );
    await expect(runtime.eval("unclass(xtabs(w ~ g + h, n))")).resolves.toEqual([
      1,
      0,
      0,
      0,
      NA,
      0,
    ]);
    await expect(runtime.eval("unclass(xtabs(w ~ g + h, n, na.rm = TRUE))")).resolves.toEqual([
      1, 0, 0, 0, 0, 0,
    ]);
    await expect(
      runtime.eval(
        "added <- xtabs(w ~ g + h, n, addNA = TRUE)\nc(dim(added), is.na(dimnames(added)[[1]]), is.na(dimnames(added)[[2]]), unclass(added))",
      ),
    ).resolves.toEqual([4, 3, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 2, 0, NA, 0, 0, 4, 0, 0, 0]);
    await expect(
      runtime.eval(
        "omitted <- xtabs(w ~ g + h, n, na.action = na.omit)\nc(dim(omitted), unclass(omitted))",
      ),
    ).resolves.toEqual([3, 1, 1, 0, 0]);

    await expect(
      runtime.eval(
        "m <- data.frame(g = factor(c('a', 'b', 'a')), x = c(1, 2, 3), y = c(10, 20, 30))\ncombined <- xtabs(cbind(x, y) ~ g, m)\nc(dim(combined), unclass(combined), dimnames(combined)[[2]])",
      ),
    ).resolves.toEqual(["2", "2", "4", "2", "40", "20", "x", "y"]);
    await expect(runtime.eval("xtabs(~ g:h, d)")).rejects.toThrow(/interactions/u);
    await expect(runtime.eval("xtabs(~ g + h, d, sparse = TRUE)")).rejects.toMatchObject({
      code: "NRU6131",
    });
    await expect(runtime.eval("xtabs(h ~ g, d)")).rejects.toThrow(/left-hand side/u);
    await expect(runtime.eval("xtabs(~ c(1, 2) + c(1, 2, 3))")).rejects.toThrow(
      /variable lengths/u,
    );
    await runtime.dispose();
  });

  it("evaluates with() data masks and local() environments without leaking assignments", async () => {
    const runtime = await session();
    await expect(runtime.eval("z <- 10; with(list(x = 1, y = 2), x + y + z)")).resolves.toBe(13);
    await expect(runtime.eval("with(data.frame(x = 1:3, y = 4:6), x + y)")).resolves.toEqual([
      5, 7, 9,
    ]);
    await expect(runtime.eval("x <- 10; c(with(list(x = 1), { x <- 2; x }), x)")).resolves.toEqual([
      2, 10,
    ]);
    await expect(
      runtime.eval("e <- new.env(); e$x <- 1; c(with(e, { x <- 2; x }), e$x)"),
    ).resolves.toEqual([2, 2]);
    await expect(
      runtime.eval('marker <- 10; c(local({ hidden <- 1; hidden + marker }), exists("hidden"))'),
    ).resolves.toEqual([11, 0]);
    await expect(
      runtime.eval("e <- new.env(); c(local({ answer <- 3; answer }, envir = e), e$answer)"),
    ).resolves.toEqual([3, 3]);
    await expect(runtime.evalDetailed("with(list(x = 1), invisible(x))")).resolves.toMatchObject({
      value: 1,
      visible: false,
    });
    await expect(runtime.evalDetailed("eval(quote(invisible(3)))")).resolves.toMatchObject({
      value: 3,
      visible: false,
    });
    await runtime.dispose();
  });
});
