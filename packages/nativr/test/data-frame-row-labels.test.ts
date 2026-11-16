import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";

const fixture = JSON.parse(
  await readFile(new URL("fixtures/data-frame-row-labels.json", import.meta.url), "utf8"),
) as { cases: { id: string; code: string }[] };
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
});
afterAll(async () => runtime.dispose());
it.each(fixture.cases)("data-frame row labels: $id", async ({ code }) => {
  await runtime.reset();
  const result = await runtime.evalDetailed(code);
  expect(result.value).toBe(true);
  expect(result.warnings).toEqual([]);
  expect(result.topLevelErrors).toEqual([]);
});

it("orders row-indexed data-frame attributes after the row labels", async () => {
  await runtime.reset();
  await expect(
    runtime.eval(`
      d <- data.frame(value = c(17L, 29L, 31L), tag = c("a", "b", "c"))
      c(
        names(attributes(d[c(3L, 1L), , drop = FALSE])),
        names(attributes(d[c(1L, 1L), , drop = FALSE])),
        names(attributes(d[, ])),
        names(attributes(d[, "value", drop = FALSE]))
      )
    `),
  ).resolves.toEqual([
    ...["names", "row.names", "class"],
    ...["names", "row.names", "class"],
    ...["names", "class", "row.names"],
    ...["names", "class", "row.names"],
  ]);
});

it("resolves unmatched character row selectors within the default step budget", async () => {
  await runtime.reset();
  await expect(
    runtime.eval(`
      d <- data.frame(x = seq_len(4000L), y = seq_len(4000L))
      x <- d[paste0("z", seq_len(4000L)), ]
      c(nrow(x), is.na(x$x[4000L]), identical(rownames(x)[4000L], "NA.3999"))
    `),
  ).resolves.toEqual([4000, 1, 1]);
});
