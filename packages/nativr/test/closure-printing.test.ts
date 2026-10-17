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
// Independently authored cases observed through GNU R 4.6.1 in the C locale.
const cases = [
  {
    id: "closure-print-expression-body",
    code: "capture.output(print(function(x, y = 1, ...) x + y))",
    expected: ["function (x, y = 1, ...) ", "x + y"],
  },
  {
    id: "closure-deparse-expression-body",
    code: "deparse(function(x, y = 1, ...) x + y)",
    expected: ["function (x, y = 1, ...) ", "x + y"],
  },
  {
    id: "closure-print-empty-block",
    code: "capture.output(print(function() {}))",
    expected: ["function () ", "{", "}"],
  },
  {
    id: "closure-print-block-and-if",
    code: "capture.output(print(function(x, y = 1, ...) { a <- x + y; if (a > 3) { a <- a * 2; a } else 0 }))",
    expected: [
      "function (x, y = 1, ...) ",
      "{",
      "    a <- x + y",
      "    if (a > 3) {",
      "        a <- a * 2",
      "        a",
      "    }",
      "    else 0",
      "}",
    ],
  },
  {
    id: "closure-print-list-recursion",
    code: "capture.output(print(list(f = function(x) { x <- x + 1; x^2 })))",
    expected: ["$f", "function (x) ", "{", "    x <- x + 1", "    x^2", "}", ""],
  },
  {
    id: "closure-print-top-if",
    code: "capture.output(print(function(x) if (x) { 1; 2 } else { 3; 4 }))",
    expected: ["function (x) ", "if (x) {", "    1", "    2", "} else {", "    3", "    4", "}"],
  },
  {
    id: "closure-print-nested-control-flow",
    code: "capture.output(print(function(x) { for (i in 1:3) { if (i > 2) next; x <- x + i }; x }))",
    expected: [
      "function (x) ",
      "{",
      "    for (i in 1:3) {",
      "        if (i > 2) ",
      "            next",
      "        x <- x + i",
      "    }",
      "    x",
      "}",
    ],
  },
  {
    id: "closure-print-nested-function",
    code: "capture.output(print(function(x) function(y=2) { x + y }))",
    expected: ["function (x) ", "function(y = 2) {", "    x + y", "}"],
  },
  {
    id: "closure-print-nonsyntactic-formal",
    code: "capture.output(print(function(`odd name` = 1:3, ...) NULL))",
    expected: ["function (`odd name` = 1:3, ...) ", "NULL"],
  },
  {
    id: "closure-print-wrapped-formals",
    code: "capture.output(print(function(x = 123456789, second_parameter_name = c(1, 2, 3), another_parameter = c(10, 20, 30), last_parameter = 4) x + second_parameter_name + another_parameter + last_parameter))",
    expected: [
      "function (x = 123456789, second_parameter_name = c(1, 2, 3), ",
      "    another_parameter = c(10, 20, 30), last_parameter = 4) ",
      "x + second_parameter_name + another_parameter + last_parameter",
    ],
  },
  {
    id: "closure-print-wrapped-call",
    code: "capture.output(print(function(x) { y <- list(first_argument=x+1, second_argument=x+2, third_argument=x+3, fourth_argument=x+4); y }))",
    expected: [
      "function (x) ",
      "{",
      "    y <- list(first_argument = x + 1, second_argument = x + 2, ",
      "        third_argument = x + 3, fourth_argument = x + 4)",
      "    y",
      "}",
    ],
  },
  {
    id: "closure-print-closure-attributes",
    code: "f <- function(x) x + 1; attr(f, 'note') <- 'tag'; capture.output(print(f))",
    expected: ["function (x) ", "x + 1", 'attr(,"note")', '[1] "tag"'],
  },
  {
    id: "closure-print-base-environment",
    code: "f <- function(x) x + 1; environment(f) <- baseenv(); capture.output(print(f))",
    expected: ["function (x) ", "x + 1", "<environment: base>"],
  },
  {
    id: "closure-print-empty-environment",
    code: "f <- function(x) x + 1; environment(f) <- emptyenv(); capture.output(print(f))",
    expected: ["function (x) ", "x + 1", "<environment: R_EmptyEnv>"],
  },
];
for (const testCase of cases) {
  it(testCase.id, async () => {
    await runtime.reset();
    const result = await runtime.evalDetailed(testCase.code);
    expect(result.value).toEqual(testCase.expected);
    expect(result.warnings).toEqual([]);
  });
}

it("collapses closure deparse lines with explicit separators or keeps the vector", async () => {
  await runtime.reset();
  expect(await runtime.eval("deparse1(function(x) { x + 1; x^2 })")).toBe(
    "function (x)  {     x + 1     x^2 }",
  );
  expect(await runtime.eval('deparse1(function(x) x + 1, collapse = "...")')).toBe(
    "function (x) ...x + 1",
  );
  expect(await runtime.eval("deparse1(function(x) x + 1, collapse = NULL)")).toEqual([
    "function (x) ",
    "x + 1",
  ]);
});

it("bounds closure formatting work and printed text", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000, maxOutputBytes: 80 },
  });
  try {
    await limited.eval(
      `f <- function() { ${Array.from({ length: 2000 }, () => "1L").join(";")} }; invisible(NULL)`,
    );
    await expect(limited.eval("print(f)")).rejects.toMatchObject({ code: "NRL4001" });
    await limited.eval(`f <- function() "${"x".repeat(200)}"; invisible(NULL)`);
    await expect(limited.eval("print(f)")).rejects.toMatchObject({ code: "NRL4007" });
  } finally {
    await limited.dispose();
  }
});

it("retains attributes when deparsing a closure", async () => {
  await runtime.reset();
  expect(
    await runtime.eval('f <- function(x) x + 1; attr(f, "note") <- "tag"; deparse(f)'),
  ).toEqual(["structure(function (x) ", 'x + 1, note = "tag")']);
});

it("uses stable owned labels for anonymous closure environments", async () => {
  await runtime.reset();
  expect(
    await runtime.eval(`
    f <- local({ k <- 2; function(x) x + k })
    a <- capture.output(print(f))
    b <- capture.output(print(f))
    c(identical(a, b), grepl("^<environment: nativr:[0-9]+>$", tail(a, 1)))
  `),
  ).toEqual([true, true]);
});

it("bounds value-to-syntax conversion depth and work before native recursion", async () => {
  const bounded = await createR({ execution: "inline", assets });
  try {
    await bounded.eval("x <- NULL; for (i in 1:1024) x <- list(x); invisible(NULL)");
    await expect(bounded.eval("deparse(x); invisible(NULL)")).rejects.toMatchObject({
      code: "NRL4004",
    });
    expect(await bounded.eval("1 + 1")).toBe(2);
  } finally {
    await bounded.dispose();
  }

  const workLimited = await createR({ execution: "inline", assets, limits: { maxSteps: 100 } });
  try {
    await workLimited.assign("x", new Int32Array(1000).fill(1));
    await expect(workLimited.eval("deparse(x); invisible(NULL)")).rejects.toMatchObject({
      code: "NRL4001",
    });
    expect(await workLimited.eval("1 + 1")).toBe(2);
  } finally {
    await workLimited.dispose();
  }
});
