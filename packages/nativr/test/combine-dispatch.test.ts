import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("bounds default-method re-entry and recovers the dispatch stack after failure", async () => {
  const r = await createR({ execution: "inline", assets, limits: { maxCallDepth: 20 } });
  try {
    await expect(
      r.eval('local({ c.default<-function(...)NextMethod(); c(structure(1,class="fixture")) })'),
    ).rejects.toMatchObject({ code: "NRL4004" });
    expect(await r.eval("c(1,2)")).toEqual([1, 2]);
  } finally {
    await r.dispose();
  }
});

it("dispatches namespace-registered collection methods without exposing the method globally", async () => {
  const r = await createR({
    execution: "inline",
    assets,
    packages: [
      {
        description: "Package: combinefixture\nVersion: 1.0\n",
        namespace: "export(make)\nS3method(c,combinefixture)\n",
        rSources: [
          {
            path: "R/main.R",
            source:
              'make <- function() structure(1:2,class="combinefixture"); c.combinefixture <- function(...) sum(NextMethod())',
          },
        ],
      },
    ],
  });
  try {
    expect(await r.eval("c(combinefixture::make(),3L)")).toBe(6);
    expect(await r.eval('exists("c.combinefixture",globalenv())')).toBe(false);
  } finally {
    await r.dispose();
  }
});

it("dispatches c on its first argument only and retains default dispatch for objects", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({ c.fixture <- function(...) 17L; c.default <- function(...) 19L;
      c(c(structure(1,class="fixture"),2),c(structure(1,class="other"),2),
      c(1,structure(2,class="fixture")),c(NULL,structure(3,class="fixture")),c(4,5)) })`),
    ).toEqual([17, 19, 1, 2, 3, 4, 5]);
  } finally {
    await r.dispose();
  }
});

it("forces all c arguments before method dispatch, preserving single evaluation", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({ n<-0L; c.fixture<-function(...) { list(...); n }; c(structure(1,class="fixture"),{n<-n+1L;2}) })',
      ),
    ).toBe(1);
    expect(
      await r.eval(
        'local({ c.fixture<-function(...) 7L; tryCatch(c(structure(1,class="fixture"),stop("forced")),error=conditionMessage) })',
      ),
    ).toBe("forced");
  } finally {
    await r.dispose();
  }
});

it("continues class/default methods and falls back to the primitive without redispatch", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`local({ calls<-0L; c.first<-function(...) {calls<<-calls+1L;NextMethod()};
      c.second<-function(...) {calls<<-calls+10L;NextMethod()}; 
      result<-c(structure(1:2,class=c("first","second")),z=3L); c(unname(result),calls,is.object(result)) })`),
    ).toEqual([1, 2, 3, 11, 0]);
  } finally {
    await r.dispose();
  }
});
