import { expect, it, vi } from "vitest";
import { EvaluationContext } from "@nativr/runtime";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Owned browser resource guards; these do not assert GNU R's resource-limit policy.
it("bounds alias cycles and recovers in the same session", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxCallDepth: 32 } });
  try {
    await runtime.eval(
      'a<-new.env(parent=emptyenv());class(a)<-c("srcfilealias","srcfile");a$original<-a;NULL',
    );
    await expect(runtime.eval("getSrcLines(a,1L,2L)")).rejects.toMatchObject({ code: "NRL4004" });
    expect(await runtime.eval("23L")).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

it("admits a table whose individual buffers fit the vector limit", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1024 } });
  try {
    await runtime.assign(
      "input",
      Array.from({ length: 40 }, () => "17L"),
    );
    await runtime.eval(
      'sf<-srcfilecopy("owned.R",input,timestamp=0,isFile=FALSE);p<-parse(text=input,keep.source=TRUE,srcfile=sf);before<-sf$parseData;NULL',
    );
    expect(await runtime.eval("nrow(utils::getParseData(p))")).toBe(80);
    expect(
      await runtime.eval('identical(sf$parseData,before)&&!exists("result",inherits=FALSE)'),
    ).toBe(true);
    expect(await runtime.eval("23L")).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

it("bounds cumulative table construction without changing the source metadata", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxVectorLength: 1024 } });
  try {
    await runtime.assign(
      "input",
      Array.from({ length: 40 }, () => "17L"),
    );
    await runtime.eval(
      'sf<-srcfilecopy("owned.R",input,timestamp=0,isFile=FALSE);p<-parse(text=input,keep.source=TRUE,srcfile=sf);before<-sf$parseData;NULL',
    );
    await expect(
      runtime.eval("local({for(i in seq_len(32L)) result<-utils::getParseData(p);NULL})"),
    ).rejects.toMatchObject({ code: "NRL4003" });
    expect(
      await runtime.eval('identical(sf$parseData,before)&&!exists("result",inherits=FALSE)'),
    ).toBe(true);
    expect(await runtime.eval("23L")).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

it("observes cancellation during table work without publishing partial results", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 10000, maxSteps: 100000 },
  });
  let interrupted = false;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- The active context is restored through call().
  const checkpoint = EvaluationContext.prototype.checkpoint;
  try {
    await runtime.assign(
      "input",
      Array.from({ length: 80 }, () => "17L"),
    );
    await runtime.eval(
      'sf<-srcfilecopy("owned.R",input,timestamp=0,isFile=FALSE);p<-parse(text=input,keep.source=TRUE,srcfile=sf);before<-sf$parseData;NULL',
    );
    const observed = vi
      .spyOn(EvaluationContext.prototype, "checkpoint")
      .mockImplementation(function (this: EvaluationContext, cost?: number) {
        if (!interrupted && this.steps >= 512) {
          interrupted = true;
          void runtime.interrupt();
        }
        checkpoint.call(this, cost);
      });
    try {
      await expect(
        runtime.eval("result<-utils::getParseData(p,includeText=TRUE)"),
      ).rejects.toMatchObject({ code: "NRL4005" });
    } finally {
      observed.mockRestore();
    }
    expect(interrupted).toBe(true);
    expect(
      await runtime.eval('identical(sf$parseData,before)&&!exists("result",inherits=FALSE)'),
    ).toBe(true);
    expect(await runtime.eval("23L")).toBe(23);
  } finally {
    await runtime.dispose();
  }
});
