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

// Independently authored cases observed through GNU R 4.6.1 in the C locale.
it("prints every atomic array slice in column-major dimension order", async () => {
  expect(await output("print(array(1:12, c(2,3,2)))")).toBe(
    ", , 1\n\n     [,1] [,2] [,3]\n[1,]    1    3    5\n[2,]    2    4    6\n\n" +
      ", , 2\n\n     [,1] [,2] [,3]\n[1,]    7    9   11\n[2,]    8   10   12\n\n",
  );
  expect(
    await output(
      'print(array(1:8,c(1,2,2,2),dimnames=list(NULL,c("a","b"),c("x","y"),c("u","v"))))',
    ),
  ).toBe(
    ", , x, u\n\n     a b\n[1,] 1 2\n\n" +
      ", , y, u\n\n     a b\n[1,] 3 4\n\n" +
      ", , x, v\n\n     a b\n[1,] 5 6\n\n" +
      ", , y, v\n\n     a b\n[1,] 7 8\n\n",
  );
});

it("preserves dimension labels and named, blank, or missing axes", async () => {
  expect(
    await output(
      'print(array(1:8,c(2,2,2),dimnames=list(rows=c("a","bb"),cols=c("X","Y"),slices=c("one","two"))))',
    ),
  ).toBe(
    ", , slices = one\n\n    cols\nrows X Y\n  a  1 3\n  bb 2 4\n\n" +
      ", , slices = two\n\n    cols\nrows X Y\n  a  5 7\n  bb 6 8\n\n",
  );
  expect(await output('print(array(1:8,c(2,2,2),dimnames=list(NULL,NULL,s=c("foo","bar"))))')).toBe(
    ", , s = foo\n\n      \n       [,1] [,2]\n  [1,]    1    3\n  [2,]    2    4\n\n" +
      ", , s = bar\n\n      \n       [,1] [,2]\n  [1,]    5    7\n  [2,]    6    8\n\n",
  );
  expect(
    await output(
      'd <- list(NULL,NULL,c("a","b")); names(d) <- "row"; print(array(1:8,c(2,2,2),dimnames=d))',
    ),
  ).toBe(
    ", , NA = a\n\n      NA\nrow    [,1] [,2]\n  [1,]    1    3\n  [2,]    2    4\n\n" +
      ", , NA = b\n\n      NA\nrow    [,1] [,2]\n  [1,]    5    7\n  [2,]    6    8\n\n",
  );
});

it("honors max across slices and reports the omitted rows, columns, or slices", async () => {
  expect(await output("print(array(1:12,c(2,3,2)),max=0)")).toBe(
    " [ reached 'max' / getOption(\"max.print\") -- omitted 2 slices ] \n",
  );
  expect(await output("print(array(1:12,c(2,3,2)),max=3)")).toBe(
    ", , 1\n\n     [,1] [,2] [,3]\n[1,]    1    3    5\n\n" +
      " [ reached 'max' / getOption(\"max.print\") -- omitted 1 slice ] \n",
  );
  expect(await output("print(array(1:12,c(2,3,2)),max=7)")).toBe(
    ", , 1\n\n     [,1] [,2] [,3]\n[1,]    1    3    5\n[2,]    2    4    6\n\n" +
      ", , 2\n\n     [,1]\n[1,]    7\n\n" +
      " [ reached 'max' / getOption(\"max.print\") -- omitted 1 row 2 columns ] \n",
  );
  expect(await output("print(matrix(1:6,2),max=2)")).toBe(
    "     [,1] [,2]\n[1,]    1    3\n" +
      " [ reached 'max' / getOption(\"max.print\") -- omitted 1 row and 1 column ]\n",
  );
});

it("prints empty array dimensions without inventing values", async () => {
  expect(await output("print(array(integer(),c(0,2,2)))")).toBe(
    ", , 1\n\n     [,1] [,2]\n\n, , 2\n\n     [,1] [,2]\n\n",
  );
  expect(await output("print(array(integer(),c(2,0,2)))")).toBe(
    ", , 1\n\n    \n[1,]\n[2,]\n\n, , 2\n\n    \n[1,]\n[2,]\n\n",
  );
  expect(await output("print(array(integer(),c(2,2,0)))")).toBe(
    "<2 x 2 x 0 array of integer>\n     [,1] [,2]\n[1,]\n[2,]\n\n",
  );
});

it("applies character quotation, alignment, missing text, and gaps to each slice", async () => {
  expect(await output('print(array(c("a","bbb",NA,"d"),c(2,1,2)))')).toBe(
    ', , 1\n\n     [,1] \n[1,] "a"  \n[2,] "bbb"\n\n' +
      ', , 2\n\n     [,1]\n[1,] NA  \n[2,] "d" \n\n',
  );
  expect(await output('print(matrix(c("a","bbb",NA,"d"),2),right=TRUE)')).toBe(
    '      [,1] [,2]\n[1,]   "a"   NA\n[2,] "bbb"  "d"\n',
  );
  expect(await output('print(matrix(c("a","bbb",NA,"d"),2),quote=FALSE)')).toBe(
    "     [,1] [,2]\n[1,] a    <NA>\n[2,] bbb  d   \n",
  );
  expect(await output("print(array(1:8,c(2,2,2)),print.gap=3)")).toBe(
    ", , 1\n\n       [,1]   [,2]\n[1,]      1      3\n[2,]      2      4\n\n" +
      ", , 2\n\n       [,1]   [,2]\n[1,]      5      7\n[2,]      6      8\n\n",
  );
});

it("checks array print output and work budgets even for zero-length storage", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxOutputBytes: 100, maxSteps: 1_000 },
  });
  try {
    await expect(limited.eval("print(array(integer(),c(0,2,1000)))")).rejects.toMatchObject({
      code: "NRL4007",
    });
    await expect(limited.eval("print(array(integer(),c(10000,0,1)))")).rejects.toMatchObject({
      code: "NRL4001",
    });
    await expect(limited.eval("print(matrix(as.double(1:30),3),width=10)")).rejects.toMatchObject({
      code: "NRL4007",
    });
  } finally {
    await limited.dispose();
  }
});

it("uses a common decimal format within each real matrix column", async () => {
  expect(await output("print(matrix(c(1,1.5,2.12345,100.5,1e-4,2e-4),2))")).toBe(
    "     [,1]      [,2]  [,3]\n[1,]  1.0   2.12345 1e-04\n[2,]  1.5 100.50000 2e-04\n",
  );
  expect(
    await output("print(matrix(c(1.23456,1234.56,10000.125,1.2,0.123456,12345.678),2),digits=3)"),
  ).toBe(
    "        [,1]    [,2]     [,3]\n[1,]    1.23 10000.1 1.23e-01\n[2,] 1234.56     1.2 1.23e+04\n",
  );
  expect(await output("print(matrix(c(1e-5,2e-5,1e5,2e5,1e20,1.5e20,1e-100,1e100),2))")).toBe(
    "      [,1]  [,2]    [,3]   [,4]\n[1,] 1e-05 1e+05 1.0e+20 1e-100\n[2,] 2e-05 2e+05 1.5e+20 1e+100\n",
  );
  expect(await output("print(matrix(c(NA,NaN,Inf,-Inf,1,NA,0,Inf),2))")).toBe(
    "     [,1] [,2] [,3] [,4]\n[1,]   NA  Inf    1    0\n[2,]  NaN -Inf   NA  Inf\n",
  );
  expect(await output("print(matrix(c(2.5,3.5,12.5,13.5),2),digits=1)")).toBe(
    "     [,1] [,2]\n[1,]    2   12\n[2,]    4   14\n",
  );
});

it("splits matrix columns into width-bounded panels with repeated labels", async () => {
  expect(await output("print(matrix(1:24,3),width=20)")).toBe(
    "     [,1] [,2] [,3]\n[1,]    1    4    7\n[2,]    2    5    8\n[3,]    3    6    9\n" +
      "     [,4] [,5] [,6]\n[1,]   10   13   16\n[2,]   11   14   17\n[3,]   12   15   18\n" +
      "     [,7] [,8]\n[1,]   19   22\n[2,]   20   23\n[3,]   21   24\n",
  );
  expect(
    await output(
      'print(matrix(1:16,2,dimnames=list(rows=c("a","bb"),cols=c("A","BB","CCC","D","E","F","G","H"))),width=20)',
    ),
  ).toBe(
    "    cols\nrows A BB CCC D  E\n  a  1  3   5 7  9\n  bb 2  4   6 8 10\n" +
      "    cols\nrows  F  G  H\n  a  11 13 15\n  bb 12 14 16\n",
  );
  expect(await output('print(matrix(c("abcdefgh","x","y","z","foo","bar"),2),width=15)')).toBe(
    '     [,1]      \n[1,] "abcdefgh"\n[2,] "x"       \n     [,2]\n[1,] "y" \n[2,] "z" \n     [,3] \n[1,] "foo"\n[2,] "bar"\n',
  );
});

it("combines width panels with array slices, zero rows, and max truncation", async () => {
  expect(await output("print(array(1:24,c(2,6,2)),width=20)")).toBe(
    ", , 1\n\n     [,1] [,2] [,3]\n[1,]    1    3    5\n[2,]    2    4    6\n" +
      "     [,4] [,5] [,6]\n[1,]    7    9   11\n[2,]    8   10   12\n\n" +
      ", , 2\n\n     [,1] [,2] [,3]\n[1,]   13   15   17\n[2,]   14   16   18\n" +
      "     [,4] [,5] [,6]\n[1,]   19   21   23\n[2,]   20   22   24\n\n",
  );
  expect(await output("print(matrix(integer(),0,8),width=20)")).toBe(
    "     [,1] [,2] [,3]\n     [,4] [,5] [,6]\n     [,7] [,8]\n",
  );
  expect(await output("print(matrix(1:24,3),width=20,max=10)")).toBe(
    "     [,1] [,2] [,3]\n[1,]    1    4    7\n     [,4] [,5] [,6]\n[1,]   10   13   16\n" +
      "     [,7] [,8]\n[1,]   19   22\n [ reached 'max' / getOption(\"max.print\") -- omitted 2 rows ]\n",
  );
  expect(await output("print(matrix(c(1.234,9.9,1e-8,1000.5),2),max=2)")).toBe(
    "      [,1]       [,2]\n[1,] 1.234 1.0000e-08\n [ reached 'max' / getOption(\"max.print\") -- omitted 1 row ]\n",
  );
  expect(await output('print(matrix(1:4,2,dimnames=list(c("a","longname"),NULL)),max=2)')).toBe(
    "         [,1] [,2]\na           1    3\n [ reached 'max' / getOption(\"max.print\") -- omitted 1 row ]\n",
  );
});

it("uses width and scientific-notation options for explicit and captured matrix output", async () => {
  try {
    await runtime.eval("options(width=20,scipen=12)");
    expect(await output("print(matrix(c(1e-4,2e-4,1e5,2e5),2))")).toBe(
      "       [,1]   [,2]\n[1,] 0.0001 100000\n[2,] 0.0002 200000\n",
    );
    expect(await runtime.eval("capture.output(matrix(1:16,2))")).toEqual([
      "     [,1] [,2] [,3]",
      "[1,]    1    3    5",
      "[2,]    2    4    6",
      "     [,4] [,5] [,6]",
      "[1,]    7    9   11",
      "[2,]    8   10   12",
      "     [,7] [,8]",
      "[1,]   13   15",
      "[2,]   14   16",
    ]);
  } finally {
    await runtime.eval("options(width=80,scipen=0)");
  }
});
