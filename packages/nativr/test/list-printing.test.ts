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
    id: "list-print-nested-named-paths",
    code: "capture.output(print(list(args = list(eps = 1e-4, d = .01))))",
    expected: ["$args", "$args$eps", "[1] 1e-04", "", "$args$d", "[1] 0.01", "", ""],
  },
  {
    id: "list-print-nested-unnamed-paths",
    code: "capture.output(print(list(list(1, list(x = 2)))))",
    expected: [
      "[[1]]",
      "[[1]][[1]]",
      "[1] 1",
      "",
      "[[1]][[2]]",
      "[[1]][[2]]$x",
      "[1] 2",
      "",
      "",
      "",
    ],
  },
  {
    id: "list-print-nested-nonsyntactic-paths",
    code: 'capture.output(print(list("odd key" = list("nested key" = 2))))',
    expected: ["$`odd key`", "$`odd key`$`nested key`", "[1] 2", "", ""],
  },
  {
    id: "list-print-ordered-attributes",
    code: 'capture.output(print(structure(list(a = 1, b = list(c = 2)), class = "Darray", note = "tag")))',
    expected: [
      "$a",
      "[1] 1",
      "",
      "$b",
      "$b$c",
      "[1] 2",
      "",
      "",
      'attr(,"class")',
      '[1] "Darray"',
      'attr(,"note")',
      '[1] "tag"',
    ],
  },
  {
    id: "list-print-classed-child-path-reset",
    code: 'capture.output(print(list(x = structure(list(a = 1), class = "tag"))))',
    expected: ["$x", "$a", "[1] 1", "", 'attr(,"class")', '[1] "tag"', ""],
  },
  {
    id: "list-print-empty-with-attributes",
    code: 'capture.output(print(structure(list(), class = "tag", note = "a")))',
    expected: ["list()", 'attr(,"class")', '[1] "tag"', 'attr(,"note")', '[1] "a"'],
  },
];

for (const testCase of cases) {
  it(testCase.id, async () => {
    const result = await runtime.evalDetailed(testCase.code);
    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual(testCase.expected);
  });
}

it("bounds deep list printing before exhausting the JavaScript stack", async () => {
  await runtime.eval("deep <- NULL; for (i in 1:1000) deep <- list(deep); invisible(NULL)");
  await expect(runtime.eval("print(deep)")).rejects.toMatchObject({ code: "NRL4004" });
  expect(await runtime.eval("1 + 1")).toBe(2);
});

it("bounds accumulated list output before traversing every child", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1500, maxOutputBytes: 80 },
  });
  try {
    await limited.eval('wide <- rep(list("abcdef"), 1000); invisible(NULL)');
    await expect(limited.eval("print(wide)")).rejects.toMatchObject({ code: "NRL4007" });
    expect(await limited.eval("1 + 1")).toBe(2);
  } finally {
    await limited.dispose();
  }
});
