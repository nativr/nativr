import { describe, expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

const featureCases = [
  {
    id: "comparisons",
    surfaces: "< <= > >= == !=",
    code: "c(1 < 2, 2 <= 2, 3 > 2, 3 >= 3, 1 == 1, 1 != 2)",
    expected: [true, true, true, true, true, true],
  },
  {
    id: "logical-operators",
    surfaces: "! & | && ||",
    code: "c(!FALSE, TRUE & FALSE, TRUE | FALSE, TRUE && FALSE, FALSE || TRUE)",
    expected: [true, false, true, false, true],
  },
  {
    id: "subsetting",
    surfaces: "[",
    code: "x <- 1:4\nm <- matrix(1:4, nrow = 2)\nc(x[c(1, 4)], m[2, 2])",
    expected: [1, 4, 4],
  },
  {
    id: "extraction",
    surfaces: "[[ $",
    code: "x <- list(a = list(b = 3), c = 4)\nc(x[[c(1, 1)]], x$a$b, x$c)",
    expected: [3, 3, 4],
  },
  {
    id: "conditionals",
    surfaces: "if else",
    code: "if (1 < 2) 2 else 3",
    expected: 2,
  },
  {
    id: "return",
    surfaces: "return",
    code: "f <- function(x) { if (x > 0) return(x); 0 }\nf(3)",
    expected: 3,
  },
  {
    id: "loops",
    surfaces: "for while repeat break next",
    code: `
      total <- 0
      for (i in 1:3) total <- total + i
      i <- 0
      while (i < 2) { i <- i + 1; total <- total + i }
      repeat { total <- total + 1; break }
      total
    `,
    expected: 10,
  },
  {
    id: "lists",
    surfaces: "list as.list pairlist",
    code: "length(list(1, 2)) + length(as.list(1:2)) + length(pairlist(1, 2))",
    expected: 6,
  },
  {
    id: "names-attributes",
    surfaces:
      "names setNames unname attr attributes structure class unclass rownames colnames dimnames",
    code: `
      m <- structure(
        matrix(1:4, nrow = 2),
        dimnames = list(c("r1", "r2"), c("c1", "c2")),
        class = c("score", "matrix")
      )
      x <- setNames(1:2, c("a", "b"))
      a <- attributes(m)
      c(
        length(names(x)) == 2,
        length(names(unname(x))) == 0,
        attr(m, "class")[[1]] == "score",
        length(a) >= 3,
        class(m)[[1]] == "score",
        class(unclass(m))[[1]] == "matrix",
        rownames(m)[[2]] == "r2",
        colnames(m)[[2]] == "c2",
        dimnames(m)[[1]][[1]] == "r1"
      )
    `,
    expected: [true, true, true, true, true, true, true, true, true],
  },
  {
    id: "sequences-repetition",
    surfaces: ": seq seq_along seq_len rep rep_len",
    code: `
      vector_times <- rep(1:2, times = c(1, 2))
      sum(c(seq(1, 3), seq_along(c(4, 5)), seq_len(3), rep(c(1, 2), 2), rep_len(c(1, 2), 3), 1:3)) +
        length(vector_times)
    `,
    expected: 34,
  },
  {
    id: "pipes",
    surfaces: "|> %>%",
    code: "native <- 1:3 |> sum()\nmagrittr <- 1:3 %>% sum()\nnative + magrittr",
    expected: 12,
  },
  {
    id: "formulas",
    surfaces: "~ formula all.vars",
    code: "length(all.vars(formula(y ~ x * z)))",
    expected: 3,
  },
  {
    id: "data-frames",
    surfaces: "data.frame as.data.frame tibble tribble",
    code: `
      a <- data.frame(1:2)
      b <- as.data.frame(list(x = 3:4))
      c <- tibble(x = 5:6)
      d <- tribble(~x, 7, 8)
      nrow(a) + nrow(b) + nrow(c) + nrow(d)
    `,
    expected: 8,
  },
  {
    id: "matrices-arrays",
    surfaces: "matrix array as.matrix dim nrow ncol rbind cbind",
    code: `
      m <- matrix(1:4, nrow = 2)
      a <- array(1:8, dim = c(2, 2, 2))
      converted <- as.matrix(data.frame(x = 1:2, y = 3:4))
      rows <- rbind(1:2, 3:4)
      columns <- cbind(1:2, 3:4)
      sum(c(dim(m), dim(a), dim(converted), nrow(rows), ncol(columns)))
    `,
    expected: 18,
  },
  {
    id: "factors",
    surfaces: "factor ordered levels droplevels",
    code: `
      f <- factor(c("a", "b", "a"), labels = c("A", "B"))
      o <- ordered(c("low", "high"), levels = c("low", "high"))
      dropped <- droplevels(f[1])
      c(levels(f), levels(dropped), class(o)[1])
    `,
    expected: ["A", "B", "A", "ordered"],
  },
  {
    id: "string-helpers",
    surfaces:
      "paste paste0 sprintf format grep grepl gsub sub strsplit substring substr nchar tolower toupper chartr",
    code: `
      a <- paste("a", "b", sep = "-")
      b <- paste0("a", "b")
      c1 <- sprintf("%02d", 3)
      d <- format(1.2, nsmall = 1)
      e <- grep("a", c("a", "b"))
      f <- grepl("a", c("a", "b"))
      g <- gsub("a", "A", "aba")
      h <- sub("a", "A", "aba")
      i <- strsplit("a,b", ",")[[1]][[2]]
      j <- substring("abc", 2, 3)
      k <- substr("abc", 2, 3)
      l <- nchar("é")
      m <- tolower("A")
      n <- toupper("a")
      o <- chartr("a", "A", "a")
      c(
        a == "a-b", b == "ab", c1 == "03", d == "1.2", e == 1,
        f[[1]], !f[[2]], g == "AbA", h == "Aba", i == "b",
        j == "bc", k == "bc", l == 1, m == "a", n == "A", o == "A"
      )
    `,
    expected: Array.from({ length: 16 }, () => true),
  },
  {
    id: "sorting-matching",
    surfaces: "sort order rank unique duplicated match which which.max which.min",
    code: `
      a <- sort(c(3, 1, 2))
      b <- order(c(3, 1, 2))
      c1 <- rank(c(30, 10, 20))
      d <- unique(c(1, 1, 2))
      e <- duplicated(c(1, 1, 2))
      f <- match(c("b", "a"), c("a", "b"))
      g <- which(c(FALSE, TRUE, TRUE))
      h <- which.max(c(1, 3, 2))
      i <- which.min(c(1, -1, 2))
      c(sum(a), sum(b), sum(c1), sum(d), sum(e), sum(f), sum(g), h, i)
    `,
    expected: [6, 6, 6, 3, 1, 3, 5, 2, 2],
  },
  {
    id: "apply-family",
    surfaces: "apply lapply sapply vapply mapply Map Reduce Filter by aggregate",
    code: `
      a <- apply(matrix(1:4, nrow = 2), 1, sum)
      b <- lapply(1:3, function(x) x)
      c1 <- sapply(1:3, function(x) x)
      d <- vapply(1:3, function(x) x ^ 1, 0)
      e <- mapply(function(x, y) x + y, 1:3, 4:6)
      f <- Map(function(x, y) x + y, 1:3, 4:6)
      g <- Reduce(function(x, y) x + y, 1:3)
      h <- Filter(function(x) x > 1, 1:3)
      i <- by(1:4, c("a", "a", "b", "b"), mean)
      j <- aggregate(1:4, list(c("a", "a", "b", "b")), mean)
      length(a) + length(b) + length(c1) + length(d) + length(e) +
        length(f) + length(g) + length(h) + length(i) + nrow(j)
    `,
    expected: 24,
  },
  {
    id: "statistics",
    surfaces: "mean sum sd var median quantile cor cov min max range summary table prop.table",
    code: `
      a <- mean(1:3)
      b <- sum(1:3)
      c1 <- sd(1:3)
      d <- var(1:3)
      e <- median(1:3)
      f <- quantile(1:3, 0.5)
      g <- cor(1:3, 2:4)
      h <- cov(1:3, 2:4)
      i <- min(1:3)
      j <- max(1:3)
      k <- range(1:3)
      l <- summary(1:3)
      m <- table(c("a", "b", "a"))
      n <- prop.table(m)
      c(a, b, c1, d, e, f, g, h, i, j, length(k), length(l), length(m), sum(n))
    `,
    expected: [2, 6, 1, 1, 2, 2, 1, 1, 1, 3, 2, 6, 2, 1],
  },
  {
    id: "random-numbers",
    surfaces: "set.seed sample runif rnorm rbinom rpois rchisq rt rexp",
    code: `
      set.seed(42)
      a <- sample(1:3, 2)
      b <- runif(2)
      c1 <- rnorm(2)
      d <- rbinom(2, 3, 0.5)
      e <- rpois(2, 2)
      f <- rchisq(2, 3)
      g <- rt(2, 5)
      h <- rexp(2)
      length(a) + length(b) + length(c1) + length(d) +
        length(e) + length(f) + length(g) + length(h)
    `,
    expected: 16,
  },
  {
    id: "dates-times",
    surfaces: "as.Date as.POSIXct strptime strftime difftime Sys.Date Sys.time",
    code: `
      length(list(
        as.Date("1970-01-02"),
        as.POSIXct("1970-01-01T00:00:00Z"),
        strptime("1970-01-02", "%Y-%m-%d"),
        strftime(as.POSIXct("1970-01-02", tz = "UTC"), "%F", tz = "UTC"),
        difftime(as.Date("1970-01-02"), as.Date("1970-01-01")),
        Sys.Date(),
        Sys.time()
      ))
    `,
    expected: 7,
  },
  {
    id: "namespaces",
    surfaces: ":: :::",
    code: "stats::mean(1:3) + base:::sum(1:2)",
    expected: 5,
  },
  {
    id: "ellipsis",
    surfaces: "... before and after named formals",
    code: `
      f <- function(..., na.rm = FALSE) mean(c(...), na.rm = na.rm)
      f(1, NA, 3, na.rm = TRUE)
    `,
    expected: 2,
  },
  {
    id: "replacement",
    surfaces: "[<- [[<- $<-",
    code: `
      x <- 1:3
      x[2] <- 20
      y <- list(1, 2)
      y[[1]] <- 10
      z <- list(a = 1)
      z$b <- 2
      c(x[2], y[[1]], z$b)
    `,
    expected: [20, 10, 2],
  },
  {
    id: "object-systems",
    surfaces: "UseMethod NextMethod setClass setGeneric setMethod R6Class new_class new_vctr",
    code: `
      generic <- function(x) UseMethod("generic")
      generic.score <- function(x) NextMethod()
      generic.numeric <- function(x) sum(x)
      score <- structure(1:3, class = c("score", "numeric"))
      s3 <- generic(score)

      setClass("Person")
      setGeneric("label", function(x) "fallback")
      setMethod("label", "Person", function(x) "person")
      person <- new("Person", name = "Ada")

      Box <- R6Class("Box", public = list(value = 1))
      box <- Box$new(value = 3)
      class_descriptor <- new_class("score")
      vector <- new_vctr(1:3, class = "score_vctr")
      list(
        s3,
        label(person),
        person$name,
        box$value,
        inherits(box, "Box"),
        inherits(class_descriptor, "vctrs_class"),
        inherits(vector, "score_vctr")
      )
    `,
    expected: [6, "person", "Ada", 3, true, true, true],
  },
] as const;

describe("download-weighted feature-priority acceptance matrix", () => {
  it("contains one executable acceptance case for every measured group", () => {
    expect(featureCases.map((entry) => entry.id)).toEqual([
      "comparisons",
      "logical-operators",
      "subsetting",
      "extraction",
      "conditionals",
      "return",
      "loops",
      "lists",
      "names-attributes",
      "sequences-repetition",
      "pipes",
      "formulas",
      "data-frames",
      "matrices-arrays",
      "factors",
      "string-helpers",
      "sorting-matching",
      "apply-family",
      "statistics",
      "random-numbers",
      "dates-times",
      "namespaces",
      "ellipsis",
      "replacement",
      "object-systems",
    ]);
  });

  it.each(featureCases)("$id supports $surfaces", async ({ code, expected }) => {
    const runtime = await createR({ execution: "inline", assets });
    await expect(runtime.eval(code)).resolves.toEqual(expected);
    await runtime.dispose();
  });
});
