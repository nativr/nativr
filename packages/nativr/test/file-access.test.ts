import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("checks access modes across browser-owned files and directories", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        root <- tempfile("file-access-")
        dir.create(root)
        entry <- file.path(root, "entry")
        file.create(entry)
        paths <- c(entry, root, file.path(root, "missing"), NA_character_, "")
        result <- c(
          identical(names(formals(file.access)), c("names", "mode")),
          identical(typeof(file.access), "closure"),
          identical(unname(file.access(paths)), c(0L, 0L, -1L, -1L, -1L)),
          identical(names(file.access(paths)), paths),
          identical(unname(file.access(paths, mode = 1L))[1:2], c(-1L, 0L)),
          identical(unname(file.access(paths, mode = 2L))[1:2], c(0L, 0L)),
          identical(unname(file.access(paths, mode = 4L))[1:2], c(0L, 0L)),
          identical(unname(file.access(paths, mode = 7L))[1:2], c(-1L, 0L)),
          identical(unname(file.access(paths, mode = "4"))[1:2], c(0L, 0L)),
          identical(names(file.access(character())), character()),
          identical(length(file.access(character())), 0L),
          inherits(try(file.access(paths, mode = 8L), silent = TRUE), "try-error"),
          inherits(try(file.access(1L), silent = TRUE), "try-error")
        )
        unlink(root, recursive = TRUE)
        result
      `),
    ).resolves.toEqual(Array.from({ length: 13 }, () => true));
  } finally {
    await runtime.dispose();
  }
});
