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

// Independently authored inputs observed through GNU R 4.6.1 in the C locale.
const cases = [
  {
    id: "table-print-compound-empty-heading",
    code: "capture.output(print(table(c(FALSE, TRUE, TRUE))))",
    expected: ["", "FALSE  TRUE ", "    1     2 "],
  },
  {
    id: "table-print-symbol-heading",
    code: "x <- c(FALSE, TRUE, TRUE); capture.output(print(table(x)))",
    expected: ["x", "FALSE  TRUE ", "    1     2 "],
  },
  {
    id: "table-print-explicit-heading",
    code: "capture.output(print(table(flag = c(FALSE, TRUE, TRUE))))",
    expected: ["flag", "FALSE  TRUE ", "    1     2 "],
  },
  {
    id: "table-print-expression-heading",
    code: "x <- c(FALSE, TRUE, TRUE); capture.output(print(table(!x)))",
    expected: ["", "FALSE  TRUE ", "    2     1 "],
  },
  {
    id: "array-print-one-dimensional-heading",
    code: 'capture.output(print(structure(1:2, dim = 2L, dimnames = list(axis = c("x", "y")))))',
    expected: ["axis", "x y ", "1 2 "],
  },
  {
    id: "array-print-one-dimensional-unnamed-axis",
    code: 'capture.output(print(structure(1:2, dim = 2L, dimnames = list(c("x", "y")))))',
    expected: ["x y ", "1 2 "],
  },
  {
    id: "table-print-nested-heading",
    code: "capture.output(print(list(t = table(flag = c(FALSE, TRUE, TRUE)))))",
    expected: ["$t", "flag", "FALSE  TRUE ", "    1     2 ", ""],
  },
  {
    id: "table-print-two-dimensional-headings",
    code: 'capture.output(print(table(a = c("x", "y", "x"), b = c("u", "v", "v"))))',
    expected: ["   b", "a   u v", "  x 1 1", "  y 0 1"],
  },
  {
    id: "table-print-two-dimensional-empty-headings",
    code: 'capture.output(print(table(c("x", "y", "x"), c("u", "v", "v"))))',
    expected: ["   ", "    u v", "  x 1 1", "  y 0 1"],
  },
  {
    id: "table-print-three-dimensional-headings",
    code: 'capture.output(print(table(a = c("x", "y"), b = c("u", "v"), c = c("p", "q"))))',
    expected: [
      ", , c = p",
      "",
      "   b",
      "a   u v",
      "  x 1 0",
      "  y 0 0",
      "",
      ", , c = q",
      "",
      "   b",
      "a   u v",
      "  x 0 0",
      "  y 0 1",
      "",
    ],
  },
  {
    id: "table-print-empty-one-dimensional",
    code: "capture.output(print(table(a = integer())))",
    expected: "< table of extent 0 >",
  },
  {
    id: "table-print-empty-two-dimensional",
    code: 'capture.output(print(structure(integer(), dim = c(2L, 0L), dimnames = list(a = c("x", "y"), b = character()), class = "table")))',
    expected: "< table of extent 2 x 0 >",
  },
  {
    id: "table-print-empty-three-dimensional",
    code: 'capture.output(print(structure(integer(), dim = c(0L, 2L, 2L), class = "table")))',
    expected: "< table of extent 0 x 2 x 2 >",
  },
  {
    id: "table-print-attributes-suppressed",
    code: 'capture.output(print(structure(table(a = c("x", "y")), note = "hello")))',
    expected: ["a", "x y ", "1 1 "],
  },
  {
    id: "table-print-max-items",
    code: "capture.output(print(table(a = letters[1:5]), max = 2))",
    expected: [
      "a",
      "a b ",
      "1 1 ",
      " [ reached 'max' / getOption(\"max.print\") -- omitted 3 entries ]",
    ],
  },
  {
    id: "table-print-width-wrapping",
    code: "old <- options(width = 12); z <- capture.output(print(table(a = letters[1:8]))); options(old); z",
    expected: ["a", "a b c d e f ", "1 1 1 1 1 1 ", "g h ", "1 1 "],
  },
  {
    id: "table-print-missing-label",
    code: 'capture.output(print(table(a = c("x", NA, "y"), useNA = "always")))',
    expected: ["a", "   x    y <NA> ", "   1    1    1 "],
  },
  {
    id: "table-print-missing-axis-name",
    code: 'dn <- list(c("a", "b")); names(dn) <- NA_character_; capture.output(print(structure(1:2, dim = 2L, dimnames = dn, class = "table")))',
    expected: ["NA", "a b ", "1 2 "],
  },
  {
    id: "table-print-double-digits",
    code: 'capture.output(print(structure(c(.12, 2.345), dim = 2L, dimnames = list(a = c("x", "y")), class = "table"), digits = 2))',
    expected: ["a", "   x    y ", "0.12 2.35 "],
  },
  {
    id: "array-print-one-dimensional-null-labels",
    code: "capture.output(print(structure(1:2, dim = 2L, dimnames = list(a = NULL))))",
    expected: "[1] 1 2",
  },
  {
    id: "array-print-one-dimensional-empty",
    code: "capture.output(print(structure(integer(), dim = 0L, dimnames = list(a = character()))))",
    expected: "integer(0)",
  },
  {
    id: "table-input-axis-attribute-identity",
    code: "x <- c(FALSE, TRUE, TRUE); c(names(dimnames(table(x))), names(dimnames(table(!x))), names(dimnames(table(flag = x))), as.character(is.null(dimnames(table(integer()))[[1]])))",
    expected: ["x", "", "flag", "TRUE"],
  },
];

for (const testCase of cases) {
  it(testCase.id, async () => {
    const result = await runtime.evalDetailed(testCase.code);
    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual(testCase.expected);
  });
}

it("returns the original table invisibly", async () => {
  expect(
    await runtime.eval(
      't <- table(a = c("a", "b")); z <- withVisible(print(t)); c(identical(z$value, t), z$visible)',
    ),
  ).toEqual([true, false]);
});
