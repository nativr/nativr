import { expect, it } from "vitest";

import { createR } from "../src/index.js";

it("promotes a nested NULL subset before applying replacement dispatch", async () => {
  const runtime = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
  });
  try {
    expect(
      await runtime.eval(`
        x <- matrix(1:4, 2L, dimnames=list(c("a", "b"), c("c", "d")))
        names(dimnames(x))[1L] <- "row"
        identical(names(dimnames(x)), c("row", NA_character_))
      `),
    ).toBe(true);
    expect(
      await runtime.eval(`
        x <- list(1L, 2L, 3L)
        names(x) <- c("a", NA_character_)
        first <- identical(names(x), c("a", NA_character_, NA_character_))
        names(x) <- "b"
        second <- identical(names(x), c("b", NA_character_, NA_character_))
        names(x) <- character()
        third <- identical(names(x), rep(NA_character_, 3L))
        c(first, second, third)
      `),
    ).toEqual([true, true, true]);
    const printed = await runtime.evalDetailed(`
      print(array(1:4, dim=4, dimnames=list(c("a", "b", "c", "d"))))
      m <- matrix(1:6, 2, dimnames=list(c("a", "b"), c("X", "Y", "Z")))
      print(m)
      names(dimnames(m)) <- c("Rows", "Cols")
      print(m)
    `);
    expect(printed.visible).toBe(false);
    expect(printed.output).toEqual([
      { stream: "stdout", text: "a b c d \n1 2 3 4 \n" },
      { stream: "stdout", text: "  X Y Z\na 1 3 5\nb 2 4 6\n" },
      { stream: "stdout", text: "    Cols\nRows X Y Z\n   a 1 3 5\n   b 2 4 6\n" },
    ]);
    expect(
      await runtime.eval(`
        x <- 1:4
        m <- matrix(1:4, 2L)
        selected <- eval(as.call(list(as.name("["), as.name("m"), 1L, 1:2, drop=FALSE)))
        identical(eval(as.call(list(as.name("["), as.name("x"), 2L))), 2L) &&
          identical(dim(selected), c(1L, 2L)) && identical(c(selected), c(1L, 3L))
      `),
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});
