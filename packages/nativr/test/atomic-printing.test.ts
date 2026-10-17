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

async function output(code: string): Promise<string> {
  const result = await runtime.evalDetailed(code);
  expect(result.visible).toBe(false);
  expect(result.warnings).toEqual([]);
  return result.output.map((event) => event.text).join("");
}

// Independent GNU R 4.6.1 observations, with the C locale and default options.
it("wraps atomic vectors with aligned index prefixes and shared real precision", async () => {
  expect(await output("print(1:15,width=20)")).toBe(
    " [1]  1  2  3  4  5\n [6]  6  7  8  9 10\n[11] 11 12 13 14 15\n",
  );
  expect(await output("print(c(1,1.5,2.12345,100.5,1e-4,2e-4),width=25)")).toBe(
    "[1]   1.00000   1.50000\n[3]   2.12345 100.50000\n[5]   0.00010   0.00020\n",
  );
  expect(await output("print(rep(1L,12),width=20)")).toBe(" [1] 1 1 1 1 1 1 1 1\n [9] 1 1 1 1\n");
  expect(await output("print(1:12,print.gap=3,width=20)")).toBe(
    " [1]    1    2    3\n [4]    4    5    6\n [7]    7    8    9\n[10]   10   11   12\n",
  );
});

it("prints named vectors in aligned name/value panels with missing names", async () => {
  expect(await output("print(c(a=1,bigName=2000,c=3.5,d=4.1),width=25)")).toBe(
    "      a bigName       c \n    1.0  2000.0     3.5 \n      d \n    4.1 \n",
  );
  expect(
    await output('x <- c(1,NA,NaN,Inf,-Inf); names(x) <- c("a","",NA,"d","e"); print(x,width=20)'),
  ).toBe("   a      <NA>    d \n   1   NA  NaN  Inf \n   e \n-Inf \n");
  expect(await output("print(c(a=1e-5,longName=1e5),width=20)")).toBe(
    "       a longName \n   1e-05    1e+05 \n",
  );
  expect(await output("print(c(alpha=1,beta=2))")).toBe("alpha  beta \n    1     2 \n");
});

it("uses rounded exponent widths to choose notation and pads each exponent separately", async () => {
  expect(await output("print(c(9.99,99.9,999.9,.9999,.09999),digits=2)")).toBe(
    "[1] 1e+01 1e+02 1e+03 1e+00 1e-01\n",
  );
  expect(await output("print(c(1e100,1e-3,1e3,0))")).toBe("[1] 1e+100  1e-03  1e+03  0e+00\n");
  expect(await output("print(c(1e-300,1e300,0))")).toBe("[1] 1e-300 1e+300  0e+00\n");
});

it("uses only displayed vector entries for max formatting and avoids omitting one entry", async () => {
  expect(await output("print(c(1.2,2.3,10000.6789,4.123),max=2)")).toBe(
    "[1] 1.2 2.3\n [ reached 'max' / getOption(\"max.print\") -- omitted 2 entries ]\n",
  );
  expect(await output("print(1:4,max=3)")).toBe("[1] 1 2 3 4\n");
  expect(await output("print(99L,max=0)")).toBe("[1] 99\n");
  expect(await output("print(1:3,max=0)")).toBe(
    " [1]\n [ reached 'max' / getOption(\"max.print\") -- omitted 3 entries ]\n",
  );
  expect(await output("print(c(a=1,b=2),max=0)")).toBe(
    "\n [ reached 'max' / getOption(\"max.print\") -- omitted 2 entries ]\n",
  );
  expect(await output("print(setNames(numeric(),character()))")).toBe("named numeric(0)\n");
});

it("uses shared fields for character, logical, and raw vectors", async () => {
  expect(await output('print(c("a","bbb",NA,"d"),width=15)')).toBe(
    '[1] "a"   "bbb"\n[3] NA    "d"  \n',
  );
  expect(await output('print(c("a","bbb",NA,"d"),quote=FALSE,width=15)')).toBe(
    "[1] a    bbb \n[3] <NA> d   \n",
  );
  expect(await output('print(c("a","bbb",NA,"d"),right=TRUE,width=15)')).toBe(
    '[1]   "a" "bbb"\n[3]    NA   "d"\n',
  );
  expect(await output('print(setNames(c("a","bbb",NA),c("x","y","z")),width=20)')).toBe(
    '    x     y     z \n  "a" "bbb"    NA \n',
  );
  expect(await output("print(c(TRUE,FALSE,NA,TRUE,FALSE),width=20)")).toBe(
    "[1]  TRUE FALSE\n[3]    NA  TRUE\n[5] FALSE\n",
  );
  expect(await output("print(as.raw(1:10),width=20)")).toBe(
    " [1] 01 02 03 04 05\n [6] 06 07 08 09 0a\n",
  );
});

it("bounds vector formatting work and emitted panel output", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1_000, maxOutputBytes: 100 },
  });
  try {
    await limited.assign(
      "large",
      Array.from({ length: 2000 }, (_, index) => index),
    );
    await expect(limited.eval("print(large)")).rejects.toMatchObject({ code: "NRL4001" });
    await expect(limited.eval("print(as.double(1:30),width=10)")).rejects.toMatchObject({
      code: "NRL4007",
    });
  } finally {
    await limited.dispose();
  }
});
