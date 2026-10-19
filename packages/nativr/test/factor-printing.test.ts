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

// Independently authored observations through GNU R 4.6.1, C locale. No source inspection.
it("prints factor labels, missing codes and ordinary/ordered levels", async () => {
  expect(await output('print(factor(c("beta",NA,"alpha"),levels=c("alpha","beta","gamma")))')).toBe(
    "[1] beta  <NA>  alpha\nLevels: alpha beta gamma\n",
  );
  expect(
    await output('print(ordered(c("beta",NA,"alpha"),levels=c("alpha","beta","gamma")))'),
  ).toBe("[1] beta  <NA>  alpha\nLevels: alpha < beta < gamma\n");
  expect(await output("print(factor(c(NA,NA)))")).toBe("[1] <NA> <NA>\nLevels: \n");
  expect(
    await output(
      'x<-c(1L,2L,NA_integer_);attr(x,"levels")<-c("a",NA_character_);class(x)<-"factor";print(x)',
    ),
  ).toBe("[1] a    <NA> <NA>\nLevels: a <NA>\n");
});

it("prints empty factors independently of names, dimensions and incidental attributes", async () => {
  expect(await output("print(factor(character()))")).toBe("factor()\nLevels: \n");
  expect(await output("print(ordered(character()))")).toBe("ordered()\nLevels: \n");
  expect(
    await output(
      'x<-setNames(factor(character(),levels="a"),character());attr(x,"owned")<-3;print(x)',
    ),
  ).toBe("factor()\nLevels: a\n");
  expect(
    await output(
      'print(factor(character()),foo=stop("must not force"),digits=stop("must not force"),width=NULL)',
    ),
  ).toBe("factor()\nLevels: \n");
  expect(
    await output('print(factor(character()),max.levels=FALSE,quote=stop("must not force"))'),
  ).toBe("factor()\n");
});

it("uses numeric level limits independently of width and supports partial max matching", async () => {
  for (const [limit, expected] of [
    [1, "8 Levels: a ..."],
    [2, "8 Levels: a ... h"],
    [3, "8 Levels: a b ... h"],
    [4, "8 Levels: a b c ... h"],
    [8, "Levels: a b c d e f g h"],
  ] as const) {
    expect(
      await output(`print(factor(letters[1:8]),max.levels=${limit},width=stop("must not force"))`),
    ).toBe(`[1] a b c d e f g h\n${expected}\n`);
  }
  expect(await output("print(factor(letters[1:4]),max.levels=FALSE)")).toBe("[1] a b c d\n");
  expect(await output("print(ordered(letters[1:4]),max=2)")).toBe(
    "[1] a b c d\n4 Levels: a < ... < d\n",
  );
  expect(await output("print(factor(letters[1:4]),max.levels=2.8)")).toBe(
    "[1] a b c d\n4 Levels: a ... d\n",
  );
  expect(await output("print(factor(letters[1:4]),max.levels=-1)")).toBe(
    "[1] a b c d\n4 Levels: a ...\n",
  );
});

it("uses measured width boundaries and leaves the vector body's width to session options", async () => {
  for (const [width, summary] of [
    [26, "4 Levels: alpha ..."],
    [27, "4 Levels: alpha ... delta"],
    [34, "4 Levels: alpha ... delta"],
    [35, "4 Levels: alpha bravo ... delta"],
    [41, "Levels: alpha bravo charlie delta"],
  ] as const) {
    expect(await output(`print(factor(c("alpha","bravo","charlie","delta")),width=${width})`)).toBe(
      `[1] alpha   bravo   charlie delta  \n${summary}\n`,
    );
  }
  expect(
    await output(
      '(function(){o<-options(width=20);on.exit(options(o));print(factor(c("alpha","bravo","charlie","delta")),width=80)})()',
    ),
  ).toBe("[1] alpha   bravo  \n[3] charlie delta  \nLevels: alpha bravo charlie delta\n");
  expect(await output('print(ordered(c("alpha","bravo","charlie","delta")),width=30)')).toBe(
    "[1] alpha   bravo   charlie delta  \n4 Levels: alpha < ...\n",
  );
});

it("preserves named and matrix display plus incidental attributes", async () => {
  expect(await output('print(factor(setNames(c("a","bb",NA),c("n","nn","nnn"))))')).toBe(
    "   n   nn  nnn \n   a   bb <NA> \nLevels: a bb\n",
  );
  expect(await output('x<-factor(c("a","bb",NA,"a"));dim(x)<-c(2,2);print(x)')).toBe(
    "     [,1] [,2]\n[1,] a    <NA>\n[2,] bb   a   \nLevels: a bb\n",
  );
  expect(await output('x<-factor("a");attr(x,"owned")<-"hello";print(x)')).toBe(
    '[1] a\nattr(,"owned")\n[1] hello\nLevels: a\n',
  );
  expect(await output("print(x,quote=TRUE)")).toBe(
    '[1] "a"\nattr(,"owned")\n[1] "hello"\nLevels: "a"\n',
  );
});

it("prints nested factors with inherited explicit quote controls", async () => {
  expect(await output('print(list(factor(c("a",NA,"bbb"))))')).toBe(
    "[[1]]\n[1] a    <NA> bbb \nLevels: a bbb\n\n",
  );
  expect(await output('print(list(factor(c("a",NA,"bbb"))),quote=TRUE)')).toBe(
    '[[1]]\n[1] "a"   NA    "bbb"\nLevels: "a" "bbb"\n\n',
  );
  expect(await runtime.eval('capture.output(factor(c("a",NA)))')).toEqual([
    "[1] a    <NA>",
    "Levels: a",
  ]);
});

it("escapes control characters and distinguishes quoted missing labels", async () => {
  expect(await output('print(factor(c("a b","x")),quote=TRUE)')).toBe(
    '[1] "a b" "x"  \nLevels: "a b" "x"\n',
  );
  expect(await output('print(factor(c("a",NA)),quote=TRUE)')).toBe('[1] "a" NA \nLevels: "a"\n');
  expect(await output('print(factor(c("a",NA)),na.print="missing")')).toBe(
    "[1] a       missing\nLevels: a\n",
  );
  expect(await output('print(factor(c("a\\001b","a\\ab","a\\vb")))')).toBe(
    "[1] a\\001b a\\ab   a\\vb  \nLevels: a\\001b a\\ab a\\vb\n",
  );
});

it("retains output before invalid level/summary controls and preserves lazy unused width", async () => {
  for (const [control, message] of [
    ["max.levels=NA", "missing value where TRUE/FALSE needed"],
    ["max.levels=c(1,2)", "the condition has length > 1"],
    ['max.levels="two"', "argument is not interpretable as logical"],
    ["width=NULL", "missing value where TRUE/FALSE needed"],
  ] as const) {
    expect(
      await output(
        `tryCatch(print(factor(letters[1:4]),${control}),error=function(e)cat(conditionMessage(e),"\\n",sep=""))`,
      ),
    ).toBe(`[1] a b c d\n${message}\n`);
  }
  expect(
    await output(
      'tryCatch(print(factor(character()),quote=NA),error=function(e)cat(conditionMessage(e),"\\n",sep=""))',
    ),
  ).toBe("factor()\ninvalid 'quote' value\n");
  expect(
    await output(
      'tryCatch(print(factor("a"),quote=c(TRUE,FALSE)),error=function(e)cat(conditionMessage(e),"\\n",sep=""))',
    ),
  ).toBe("[1] \"a\"\ninvalid 'quote' value\n");
  await expect(
    runtime.eval('print(structure(c(1L,0L),levels="a",class="factor"))'),
  ).rejects.toThrow("malformed factor");
});

it("retains S3 dispatch, native formals, unchanged values and invisible returns after reset", async () => {
  await runtime.reset();
  expect(await runtime.eval("names(formals(print.factor))")).toEqual([
    "x",
    "quote",
    "max.levels",
    "width",
    "...",
  ]);
  expect(
    await runtime.eval(
      'local({x<-factor(c("a",NA));v<-withVisible(print.factor(x));c(identical(v$value,x),!v$visible)})',
    ),
  ).toEqual([true, true]);
  expect(
    await output('local({print.factor<-function(x,...)cat("owned\\n");print(factor("a"))})'),
  ).toBe("owned\n");
  expect(
    await output(
      'local({as.character.factor<-function(x,...)stop("must not dispatch");print(factor("a"))})',
    ),
  ).toBe("[1] a\nLevels: a\n");
});

it("bounds factor-label and level-summary work and output", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 1000, maxOutputBytes: 100 },
  });
  try {
    await limited.assign(
      "ownedLevels",
      Array.from({ length: 2000 }, (_, i) => String(i)),
    );
    await expect(
      limited.eval('print(structure(1L,levels=ownedLevels,class="factor"))'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    await expect(limited.eval('print(factor(rep("abcdefghij",20)))')).rejects.toMatchObject({
      code: "NRL4007",
    });
  } finally {
    await limited.dispose();
  }
});
