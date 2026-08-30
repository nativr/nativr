import { describe, expect, it } from "vitest";

import { createR, NA } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

async function session() {
  return createR({ execution: "inline", assets });
}

describe("measured feature boundary coverage", () => {
  it("covers attribute, sequence, and repetition variants", async () => {
    const runtime = await session();
    await expect(runtime.eval("c(a = 1:2, b = 3)")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("names(c(a = 1:2, b = 3))")).resolves.toEqual(["a1", "a2", "b"]);
    await expect(runtime.eval("names(NULL)")).resolves.toBeNull();
    await expect(runtime.eval("unname(list(a = 1))")).resolves.toEqual([1]);
    await expect(runtime.eval('attr(y ~ x, "class")')).resolves.toBe("formula");
    await expect(runtime.eval('attr(function(x) x, "class")')).resolves.toBeNull();
    await expect(runtime.eval("names(attributes(y ~ x))")).resolves.toEqual([
      "class",
      ".Environment",
    ]);
    await expect(runtime.eval("identical(attr(y ~ x, '.Environment'), globalenv())")).resolves.toBe(
      true,
    );
    await expect(runtime.eval("attributes(1:3)")).resolves.toBeNull();
    await expect(runtime.eval("rownames(matrix(1:4, nrow = 2))")).resolves.toBeNull();
    await expect(runtime.eval("colnames(c(a = 1, b = 2))")).resolves.toBeNull();
    await expect(runtime.eval("dimnames(1:3)")).resolves.toBeNull();
    await expect(runtime.eval("seq(to = 3)")).resolves.toEqual([1, 2, 3]);
    await expect(runtime.eval("seq(along.with = c(4, 5))")).resolves.toEqual([1, 2]);
    await expect(runtime.eval("seq(1, 2, length.out = 3)")).resolves.toEqual([1, 1.5, 2]);
    await expect(runtime.eval("seq_len(0)")).resolves.toEqual([]);
    await expect(runtime.eval("seq_along(NULL)")).resolves.toEqual([]);
    await expect(runtime.eval("rep(NULL, 3)")).resolves.toBeNull();
    await expect(runtime.eval("rep(1:2, each = 2, length.out = 5)")).resolves.toEqual([
      1, 1, 2, 2, 1,
    ]);
    await expect(
      runtime.eval(`
        touched <- 0L
        default <- rep(c(a = 1L, b = 2L), 2, by = { touched <- touched + 1L; 9 })
        partial <- rep(1:2, l = 5)
        duplicate_shape <- rep(1:2, 2, times = 3)
        rep.rep_probe <- function(x, ..., marker = "default") {
          list(unclass(x), list(...), marker)
        }
        method <- rep(structure(1:2, class = "rep_probe"), times = 2, by = 3, marker = "seen")
        list(default, names(default), touched, partial, duplicate_shape, method,
             list(typeof(rep), is.primitive(rep), is.null(formals(rep))))
      `),
    ).resolves.toEqual([
      [1, 2, 1, 2],
      ["a", "b", "a", "b"],
      1,
      [1, 2, 1, 2, 1],
      [1, 2],
      [[1, 2], [2, 3], "seen"],
      ["special", true, true],
    ]);
    await expect(runtime.eval("rep_len(NULL, 0)")).resolves.toBeNull();
    await expect(
      runtime.eval(`
        plain <- noquote(c(a = "x", b = "y"))
        right <- noquote(factor(c("a", "b")), right = TRUE)
        c(class(plain), names(plain), class(right), names(attr(right, "class")),
          identical(right, noquote(right, FALSE)), typeof(noquote), names(formals(noquote)))
      `),
    ).resolves.toEqual([
      "noquote",
      "a",
      "b",
      "factor",
      "noquote",
      "",
      "right",
      "TRUE",
      "closure",
      "obj",
      "right",
    ]);
    await expect(runtime.eval("noquote(NULL)")).rejects.toThrow(
      "attempt to set an attribute on NULL",
    );

    await expect(runtime.eval("names(function(x) x)")).resolves.toBeNull();
    await expect(runtime.eval('is.na(names(setNames(1:2, "a")))')).resolves.toEqual([false, true]);
    await expect(runtime.eval("dimnames(function(x) x)")).resolves.toBeNull();
    await expect(runtime.eval("seq(1, 3, by = 1, length.out = 3)")).rejects.toMatchObject({
      code: "NRE2104",
    });
    await expect(runtime.eval("rep(1:2, times = 1:3)")).rejects.toMatchObject({
      code: "NRT3168",
    });
    await expect(runtime.eval("rep_len((1:3)[FALSE], 1)")).rejects.toMatchObject({
      code: "NRE2120",
    });
    await expect(
      runtime.eval("set.seed(1.5)\na <- runif(2)\nset.seed(1)\nidentical(a, runif(2))"),
    ).resolves.toBe(true);
    await runtime.dispose();
  });

  it("covers random and string option boundaries", async () => {
    const runtime = await session();
    await expect(runtime.eval("sample(NULL)")).resolves.toBeNull();
    await expect(runtime.eval("sample((1:3)[FALSE], 0)")).resolves.toEqual([]);
    await expect(runtime.eval("set.seed(3)\nsample(1:4, 2, replace = TRUE)")).resolves.toHaveLength(
      2,
    );
    await expect(runtime.eval('paste(c("a", "b"), collapse = "-")')).resolves.toBe("a-b");
    await expect(runtime.eval('paste0(c("a", "b"), collapse = NULL)')).resolves.toEqual(["a", "b"]);
    await expect(runtime.eval('sprintf("%% %+05d %-4s", 3, "x")')).resolves.toBe("% +0003 x   ");
    await expect(runtime.eval('sprintf("%s", NA)')).resolves.toBe("NA");
    await expect(
      runtime.eval('format(c(1.2, NA), scientific = TRUE, width = 8, justify = "left")'),
    ).resolves.toEqual([" 1.2e+00", "      NA"]);
    await expect(
      runtime.eval('format(c(TRUE, FALSE), justify = "centre", width = 7)'),
    ).resolves.toEqual(["   TRUE", "  FALSE"]);
    await expect(
      runtime.eval('grep("A", c("a", NA, "b"), ignore.case = TRUE, invert = TRUE)'),
    ).resolves.toEqual([2, 3]);
    await expect(runtime.eval('grepl(".", c(".", "x"), fixed = TRUE)')).resolves.toEqual([
      true,
      false,
    ]);
    await expect(runtime.eval('gsub(".", "X", "a.b", fixed = TRUE)')).resolves.toBe("aXb");
    await expect(runtime.eval('strsplit("ab", "")[[1]]')).resolves.toEqual(["a", "b"]);
    await expect(runtime.eval('substring("abc", 4, 2)')).resolves.toBe("");
    await expect(runtime.eval('substring("abc", 2)')).resolves.toBe("bc");
    await expect(runtime.eval('chartr("a-c", "A-C", "cad")')).resolves.toBe("CAd");

    await expect(runtime.eval("rpois(1, -1)")).rejects.toMatchObject({ code: "NRT3171" });
    await expect(runtime.eval("rchisq(1, 0)")).resolves.toBe(0);
    await expect(runtime.eval("rt(1, 0)")).rejects.toMatchObject({ code: "NRT3173" });
    const invalidExponential = await runtime.evalDetailed("rexp(1, 0)");
    expect(invalidExponential.value).toBe(Number.NaN);
    expect(invalidExponential.warnings).toEqual([
      { code: "NRW1003", message: "NAs produced", call: "rexp(1, 0)" },
    ]);
    await expect(runtime.eval("sample(1:3, prob = c(1, 2))")).rejects.toMatchObject({
      code: "NRT3166",
    });
    await expect(runtime.eval("sample(1:3, prob = c(1, -1, 1))")).rejects.toMatchObject({
      code: "NRT3167",
    });
    await expect(runtime.eval("sample(1:3, prob = c(0, 0, 0))")).rejects.toMatchObject({
      code: "NRE2129",
    });
    await expect(runtime.eval("sample(1:3, 2, prob = c(1, 0, 0))")).rejects.toMatchObject({
      code: "NRE2128",
    });
    await expect(runtime.eval('format(1, justify = "diagonal")')).rejects.toMatchObject({
      code: "NRE2126",
    });
    await expect(runtime.eval('sprintf("%d")')).rejects.toMatchObject({ code: "NRE2125" });
    await expect(runtime.eval('chartr("a-b", "A", "a")')).rejects.toMatchObject({
      code: "NRE2127",
    });
    await runtime.dispose();
  });

  it("covers matrix, frame, factor, and statistics boundaries", async () => {
    const runtime = await session();
    await expect(runtime.eval("dim(matrix(nrow = 2, ncol = 2))")).resolves.toEqual([2, 2]);
    await expect(runtime.eval("dim(array(dim = c(2, 2, 1)))")).resolves.toEqual([2, 2, 1]);
    await expect(runtime.eval("dim(1:3)")).resolves.toBeNull();
    await expect(runtime.eval("nrow(1:3)")).resolves.toBeNull();
    await expect(runtime.eval("as.matrix(matrix(1:4, 2))")).resolves.toEqual([1, 2, 3, 4]);
    await expect(runtime.eval("rbind()")).resolves.toBeNull();
    await expect(runtime.eval("rbind(1:2, 3)")).resolves.toEqual([1, 3, 2, 3]);
    await expect(runtime.eval("median(c(1, NaN, 3), na.rm = TRUE)")).resolves.toBe(2);
    await expect(runtime.eval("median((1:3)[FALSE])")).resolves.toBeNaN();
    await expect(runtime.eval("var(1)")).resolves.toBe(NA);
    await expect(runtime.eval("quantile(1:3, names = FALSE)")).resolves.toEqual([
      1, 1.5, 2, 2.5, 3,
    ]);
    await expect(runtime.eval("cov(1:3)")).rejects.toMatchObject({ code: "NRT3167" });
    await expect(runtime.eval('cov(c(1, NA), c(2, 3), use = "everything")')).resolves.toBe(NA);
    await expect(runtime.eval("cor(c(1, 1), c(2, 3))")).resolves.toBe(NA);
    await expect(runtime.eval('table(c("a", NA), useNA = "always")')).resolves.toEqual([1, 1]);
    await expect(runtime.eval("table()")).rejects.toMatchObject({ code: "NRE2103" });
    await expect(runtime.eval("prop.table(c(1, 3))")).resolves.toEqual([0.25, 0.75]);
    await expect(runtime.eval("names(data.frame(1:2, y = 3:4))")).resolves.toEqual(["X1.2", "y"]);
    await expect(runtime.eval("names(as.data.frame(list(1:2, 3)))")).resolves.toEqual(["X1", "X2"]);
    await expect(runtime.eval("as.data.frame(data.frame(x = 1:2))$x")).resolves.toEqual([1, 2]);
    await expect(
      runtime.eval('levels(factor(c("a", "b", "a"), exclude = "b", labels = "A", nmax = 2))'),
    ).resolves.toBe("A");
    await expect(runtime.eval("levels(1:3)")).resolves.toBeNull();

    await expect(runtime.eval("matrix(1:3, nrow = -1)")).rejects.toMatchObject({ code: "NRT3112" });
    await expect(runtime.eval("as.matrix(function(x) x)")).rejects.toMatchObject({
      code: "NRT3125",
    });
    await expect(runtime.eval("rbind(list(1))")).resolves.toEqual([1]);
    await expect(runtime.eval("quantile(1:3, type = 6)")).resolves.toEqual([1, 1, 2, 3, 3]);
    await expect(runtime.eval("quantile(1:3, type = 10)")).rejects.toMatchObject({
      code: "NRT3166",
    });
    await expect(runtime.eval("quantile(1:3, 2)")).rejects.toMatchObject({ code: "NRT3166" });
    await expect(runtime.eval("cov(1:2, 1:3)")).rejects.toMatchObject({ code: "NRT3167" });
    await expect(runtime.eval('cov(1:3, 2:4, use = "bad")')).rejects.toMatchObject({
      code: "NRE2130",
    });
    await expect(runtime.eval("table(1:2, 1:3)")).rejects.toMatchObject({ code: "NRT3169" });
    await expect(runtime.eval("prop.table(matrix(1:4, 2), margin = 3)")).rejects.toMatchObject({
      code: "NRU6118",
    });
    await expect(runtime.eval("names(data.frame(x = list(1)))")).resolves.toBe("X1");
    await expect(
      runtime.eval("names(data.frame(list(x = 1:3, y = 4:6, z = 7:9), col = 1))"),
    ).resolves.toEqual(["x", "y", "z", "col"]);
    await expect(
      runtime.eval("names(data.frame(a = list(x = list(u = 1:2, v = 3:4), y = 5:6)))"),
    ).resolves.toEqual(["a.x.u", "a.x.v", "a.y"]);
    await expect(
      runtime.eval(
        "names(data.frame(a = list(m = matrix(1:4, 2, 2, dimnames = list(c('r1', 'r2'), c('u', 'v'))), z = 5:6)))",
      ),
    ).resolves.toEqual(["a.m.u", "a.m.v", "a.z"]);
    await expect(runtime.eval("as.data.frame(list(x = 1:2, y = 1:3))")).rejects.toMatchObject({
      code: "NRE2116",
    });
    await expect(runtime.eval("factor(list(1))")).rejects.toMatchObject({ code: "NRT3132" });
    await expect(runtime.eval('factor(c("a", "b"), labels = "A")')).rejects.toMatchObject({
      code: "NRT3172",
    });
    await expect(runtime.eval("droplevels(1:3)")).rejects.toMatchObject({ code: "NRT3134" });
    await runtime.dispose();
  });

  it("covers apply, date, and sorting option boundaries", async () => {
    const runtime = await session();
    await expect(
      runtime.eval("sapply(1:2, function(x) list(x), simplify = FALSE)"),
    ).resolves.toEqual([[1], [2]]);
    await expect(runtime.eval("vapply(c(a = 1, b = 2), function(x) x ^ 1, 0)")).resolves.toEqual([
      1, 2,
    ]);
    await expect(
      runtime.eval(
        "mapply(function(x, offset) x + offset, 1:2, MoreArgs = list(offset = 10), SIMPLIFY = FALSE)",
      ),
    ).resolves.toEqual([11, 12]);
    await expect(runtime.eval("Map(function(x) x, (1:3)[FALSE])")).resolves.toEqual([]);
    await expect(runtime.eval("Reduce(function(x, y) x - y, 1:3, right = TRUE)")).resolves.toBe(2);
    await expect(runtime.eval("Reduce(sum, (1:3)[FALSE], init = 5)")).resolves.toBe(5);
    await expect(runtime.eval("apply(matrix(1:4, 2), 2, sum)")).resolves.toEqual([3, 7]);
    await expect(runtime.eval('by(1:3, c("a", "a", "b"), sum)')).resolves.toEqual([3, 3]);
    await expect(
      runtime.eval(`
        grouped <- by(
          1:5,
          list(A = factor(c("b", "a", "b", "a", "b"), levels = c("a", "b", "c")),
               B = factor(c("u", "u", "v", "v", "u"))),
          sum
        )
        c(
          class(grouped), dim(grouped), names(dimnames(grouped)),
          dimnames(grouped)[[1]], dimnames(grouped)[[2]],
          grouped["a", "u"], is.na(grouped["c", "u"]),
          names(formals(by)), as.character(formals(by)$simplify)
        )
      `),
    ).resolves.toEqual([
      "by",
      "3",
      "2",
      "A",
      "B",
      "a",
      "b",
      "c",
      "u",
      "v",
      "2",
      "TRUE",
      "data",
      "INDICES",
      "FUN",
      "...",
      "simplify",
      "TRUE",
    ]);
    await expect(runtime.eval('as.Date(as.Date("1970-01-02"))')).resolves.toBe(1);
    await expect(runtime.eval('as.POSIXct(as.POSIXct("1970-01-01T00:00:01Z"))')).resolves.toBe(1);
    await expect(
      runtime.eval('difftime(as.Date("1970-01-03"), as.Date("1970-01-01"), units = "days")'),
    ).resolves.toBe(2);
    await expect(
      runtime.eval('as.numeric(as.POSIXct(strptime("1970-01-01 12:30", "%Y-%m-%d %H:%M")))'),
    ).resolves.toBe(45_000);
    await expect(runtime.eval("sort(c(2, NA, 1), na.last = FALSE)")).resolves.toEqual([NA, 1, 2]);
    await expect(runtime.eval("order(c(2, NA, 1), na.last = NA)")).resolves.toEqual([3, 1]);
    await expect(runtime.eval("match(c(2, 9), 1:3, nomatch = 0)")).resolves.toEqual([2, 0]);
    await expect(runtime.eval('rank(c(1, 1, 2), ties.method = "max")')).resolves.toEqual([2, 2, 3]);
    await expect(runtime.eval('rank(c(1, 1, 2), ties.method = "last")')).resolves.toEqual([
      2, 1, 3,
    ]);

    await expect(runtime.eval("vapply(1:2, identity, 0)")).resolves.toEqual([1, 2]);
    await expect(
      runtime.eval(
        'c(typeof(vapply(1:2, identity, 0)), typeof(vapply(c(TRUE, FALSE), identity, 0L)), typeof(vapply(1:2, identity, 0i)), rawToChar(vapply(charToRaw("ab"), identity, as.raw(0))))',
      ),
    ).resolves.toEqual(["double", "integer", "complex", "ab"]);
    await expect(runtime.eval("apply(1:3, 1, sum)")).rejects.toMatchObject({ code: "NRT3183" });
    await expect(runtime.eval("apply(matrix(1:4, 2), 3, sum)")).rejects.toMatchObject({
      code: "NRU6119",
    });
    await expect(runtime.eval("by(1:3, 1:2, sum)")).rejects.toMatchObject({ code: "NRT3185" });
    await expect(runtime.eval("aggregate(list(1), list(1), sum)")).rejects.toMatchObject({
      code: "NRT3186",
    });
    await expect(runtime.eval('as.POSIXct("1970-01-01", tz = "EST")')).rejects.toMatchObject({
      code: "NRU6113",
    });
    await expect(runtime.eval('strptime("1970", "%q")')).rejects.toMatchObject({ code: "NRU6121" });
    await expect(
      runtime.eval('attr(difftime(Sys.time(), Sys.time(), units = "hours"), "units")'),
    ).resolves.toBe("hours");
    await expect(runtime.eval("Sys.Date(1)")).rejects.toMatchObject({ code: "NRE2101" });
    await expect(runtime.eval("which(1:3)")).rejects.toMatchObject({ code: "NRT3143" });
    await expect(runtime.eval('rank(1:3, ties.method = "bad")')).rejects.toMatchObject({
      code: "NRE2121",
    });
    await runtime.dispose();
  });

  it("covers indexing, dispatch, and object-system boundaries", async () => {
    const runtime = await session();
    await expect(runtime.eval('list(a = 1)[["a"]]')).resolves.toBe(1);
    await expect(runtime.eval("list(list(value = 3))[[c(1, 1)]]")).resolves.toBe(3);
    await expect(runtime.eval("c(a = 1, b = 2)[c(TRUE, FALSE)]")).resolves.toBe(1);
    await expect(runtime.eval("c(1, 2)[c(1, 4)]")).resolves.toEqual([1, NA]);
    await expect(runtime.eval("list(a = 1)$missing")).resolves.toBeNull();
    await expect(runtime.eval("x <- list(1, 2)\nx[c(FALSE, FALSE)] <- 9\nx")).resolves.toEqual([
      1, 2,
    ]);
    await expect(runtime.eval('x <- c(1, 2)\nx[1] <- "a"\nx')).resolves.toEqual(["a", "2"]);
    await expect(runtime.eval("m <- matrix(1:4, 2)\nm[, 1] <- c(10, 20)\nm")).resolves.toEqual([
      10, 20, 3, 4,
    ]);
    await expect(runtime.eval("df <- data.frame(x = 1:2)\ndf[, 1] <- 9\ndf$x")).resolves.toEqual([
      9, 9,
    ]);

    await runtime.eval(`
      generic <- function(x) UseMethod("generic", x)
      generic.default <- function(x) "default"
      NULL
    `);
    await expect(runtime.eval("generic(1)")).resolves.toBe("default");
    await runtime.eval(`
      setClass("Child", contains = "Parent", representation = list(value = "numeric"))
      setGeneric("fallback", function(x) "fallback")
      setMethod("fallback", "ANY", function(x) "any")
      NULL
    `);
    await expect(runtime.eval('inherits(new("Child"), "Parent")')).resolves.toBe(true);
    await expect(runtime.eval("fallback(1)")).resolves.toBe("any");
    await runtime.eval(
      'Base <- R6::R6Class("Base")\nChild <- R6::R6Class("Child", inherit = Base)\nNULL',
    );
    await expect(runtime.eval('inherits(Child$new(), "Child")')).resolves.toBe(true);
    await expect(runtime.eval('class(vctrs::new_vctr(1:2, class = "vctrs_vctr"))')).resolves.toBe(
      "vctrs_vctr",
    );

    await expect(runtime.eval("1[[1]]")).resolves.toBe(1);
    await expect(runtime.eval("list(1)[[2]]")).rejects.toMatchObject({ code: "NRE2202" });
    await expect(runtime.eval("list(list(1))[[c(1, 1, 1)]]")).resolves.toBe(1);
    await expect(runtime.eval("1$missing")).rejects.toMatchObject({ code: "NRT3304" });
    await expect(runtime.eval("m <- matrix(1:4, 2)\nm[NA, 1] <- 3")).rejects.toMatchObject({
      code: "NRE2212",
    });
    await expect(runtime.eval('UseMethod("")')).rejects.toMatchObject({ code: "NRE2213" });
    await expect(runtime.eval('UseMethod("missing")')).rejects.toMatchObject({ code: "NRE2214" });
    await expect(runtime.eval("NextMethod()")).rejects.toMatchObject({ code: "NRE2215" });
    await expect(runtime.eval('setGeneric("bad", 1)')).rejects.toMatchObject({ code: "NRT3160" });
    await expect(runtime.eval('setMethod("bad", "ANY", 1)')).rejects.toMatchObject({
      code: "NRT3161",
    });
    await expect(runtime.eval('R6::R6Class("Bad", public = 1)')).rejects.toMatchObject({
      code: "NRT3165",
    });
    await expect(runtime.eval('vctrs::new_vctr("x", class = "v")')).resolves.toEqual("x");
    await expect(runtime.eval("vctrs::new_vctr(function(x) x)")).rejects.toMatchObject({
      code: "NRT3162",
    });
    await expect(runtime.eval("unknown::mean(1:3)")).rejects.toMatchObject({ code: "NRE2210" });
    await expect(runtime.eval("stats::sum(1:3)")).rejects.toMatchObject({ code: "NRE2211" });
    await runtime.dispose();
  });
});
