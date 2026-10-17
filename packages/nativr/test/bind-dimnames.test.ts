import { afterAll, beforeAll, expect, it } from "vitest";

import { createR, type NativRSession } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
  await runtime.eval(`
    a <- c(p=11L,q=12L)
    b <- c(r=21L,s=22L)
    m <- matrix(31:34,2,dimnames=list(c("u","v"),c("A","B")))
    z <- matrix(41:44,2)
  `);
});
afterAll(async () => runtime.dispose());

// Public base bind documentation and independent GNU R 4.6.1 C-locale observations.
it("retains vector argument labels while unnamed matrix rows or columns remain blank", async () => {
  expect(await runtime.eval("dimnames(rbind(named=a,z))")).toEqual([
    ["named", "", ""],
    ["p", "q"],
  ]);
  expect(await runtime.eval("dimnames(cbind(named=a,z))")).toEqual([
    ["p", "q"],
    ["named", "", ""],
  ]);
  expect(await runtime.eval('dimnames(do.call("rbind",list(named=a,z)))')).toEqual([
    ["named", "", ""],
    ["p", "q"],
  ]);
});

it("uses matrix dimnames without prefixing them with the matrix argument name", async () => {
  expect(await runtime.eval("dimnames(rbind(named=m,z))")).toEqual([
    ["u", "v", "", ""],
    ["A", "B"],
  ]);
  expect(await runtime.eval("dimnames(cbind(named=m,z))")).toEqual([
    ["u", "v"],
    ["A", "B", "", ""],
  ]);
  expect(await runtime.eval("dimnames(rbind(named=z,z))")).toBeNull();
  expect(
    await runtime.eval(
      'n <- matrix(1:4,2,dimnames=list(c(NA,""),c(NA,"B"))); d <- dimnames(rbind(n,z)); c(identical(d[[1]],c(NA_character_,"","","")),identical(d[[2]],c(NA_character_,"B")))',
    ),
  ).toEqual([true, true]);
});

it("selects the first common-axis labels of the required length", async () => {
  expect(await runtime.eval("dimnames(rbind(a,m))")).toEqual([
    ["a", "u", "v"],
    ["p", "q"],
  ]);
  expect(await runtime.eval("dimnames(rbind(m,a))")).toEqual([
    ["u", "v", "a"],
    ["A", "B"],
  ]);
  expect(await runtime.eval("dimnames(rbind(c(k=1L),m))")).toEqual([
    ["", "u", "v"],
    ["A", "B"],
  ]);
});

it("applies deparse.level to vector labels and preserves explicit labels at level zero", async () => {
  expect(await runtime.eval("dimnames(rbind(a,b,deparse.level=0))")).toEqual([null, ["p", "q"]]);
  expect(await runtime.eval("dimnames(rbind(named=a,b,deparse.level=0))")).toEqual([
    ["named", ""],
    ["p", "q"],
  ]);
  expect(await runtime.eval("dimnames(rbind(a,b))")).toEqual([
    ["a", "b"],
    ["p", "q"],
  ]);
  expect(await runtime.eval("dimnames(rbind(11:12,a+1,deparse.level=2))")).toEqual([
    ["11:12", "a + 1"],
    ["p", "q"],
  ]);
  expect(await runtime.eval("dimnames(rbind(11:12,21:22))")).toBeNull();
});

it("budgets label traversal even when matrices have no stored cells", async () => {
  const limited = await createR({ execution: "inline", assets, limits: { maxSteps: 1_000 } });
  try {
    await expect(limited.eval("rbind(matrix(0L, nrow=10000L, ncol=0L))")).rejects.toMatchObject({
      code: "NRL4001",
    });
    await expect(limited.eval("cbind(matrix(0L, nrow=0L, ncol=10000L))")).rejects.toMatchObject({
      code: "NRL4001",
    });
  } finally {
    await limited.dispose();
  }
});
