import { expect, it, vi } from "vitest";
import { EvaluationContext } from "@nativr/runtime";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
const setup =
  'sf<-srcfilecopy("owned.R","caller-owned lines",timestamp=0,isFile=FALSE);sf$parseData<-71L;NULL';
const retained = "result<-parse(text=input,keep.source=TRUE,srcfile=sf)";
const unchanged = 'identical(sf$parseData,71L)&&!exists("result",inherits=FALSE)&&sys.nframe()==0L';
const recovery = 'eval(parse(text="23L",keep.source=TRUE,srcfile=sf))';

it("retains a long flat expression without exhausting the JavaScript normalization stack", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxCallDepth: 64, maxSteps: 1000000, maxVectorLength: 1000000 },
  });
  try {
    await runtime.assign("input", Array.from({ length: 20000 }, () => "17L").join("+"));
    expect(await runtime.eval("length(parse(text=input,keep.source=TRUE))")).toBe(1);
    expect(await runtime.eval('eval(parse(text="23L",keep.source=TRUE))')).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

// These owned guards test NativR budgets and recovery, independently of GNU R behavior.
it("bounds parse-data matrix allocation before mutating source state and recovers", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxVectorLength: 256 } });
  try {
    await runtime.eval(setup);
    await runtime.assign("input", "17L;".repeat(40));
    await expect(runtime.eval(retained)).rejects.toMatchObject({ code: "NRL4002" });
    expect(await runtime.eval(unchanged)).toBe(true);
    expect(await runtime.eval(recovery)).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

it("bounds retained lexical scanning even when only a comment is present", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 300, maxVectorLength: 1024 },
  });
  try {
    await runtime.eval(setup);
    await runtime.assign("input", "#" + "a".repeat(600_000));
    await expect(runtime.eval(retained)).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval(unchanged)).toBe(true);
    expect(await runtime.eval(recovery)).toBe(23);
  } finally {
    await runtime.dispose();
  }
});

it("guards parser recursion and ignores an unselected deep suffix with finite n", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxCallDepth: 64, maxVectorLength: 10000 },
  });
  try {
    await runtime.eval(setup);
    await runtime.assign("input", "(".repeat(200) + "17L" + ")".repeat(200));
    await expect(runtime.eval(retained)).rejects.toMatchObject({ code: "NRL4004" });
    expect(await runtime.eval(unchanged)).toBe(true);
    await runtime.assign("input", "23L;" + "(".repeat(200) + "17L" + ")".repeat(200));
    expect(await runtime.eval("eval(parse(text=input,n=1L,keep.source=TRUE,srcfile=sf))")).toBe(23);
    expect(
      await runtime.eval('identical(attr(sf$parseData,"tokens"),c("NUM_CONST","expr","\';\'"))'),
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it("observes cancellation inside retained scanning and permits same-session recovery", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxVectorLength: 1024 },
  });
  let interrupted = false;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the active context through call().
  const checkpoint = EvaluationContext.prototype.checkpoint;
  try {
    await runtime.eval(setup);
    await runtime.assign("input", "#" + "a".repeat(600_000));
    const observed = vi
      .spyOn(EvaluationContext.prototype, "checkpoint")
      .mockImplementation(function (this: EvaluationContext, cost?: number) {
        if (!interrupted && this.steps >= 256) {
          interrupted = true;
          void runtime.interrupt();
        }
        checkpoint.call(this, cost);
      });
    try {
      await expect(runtime.eval(retained)).rejects.toMatchObject({ code: "NRL4005" });
    } finally {
      observed.mockRestore();
    }
    expect(interrupted).toBe(true);
    expect(await runtime.eval(unchanged)).toBe(true);
    expect(await runtime.eval(recovery)).toBe(23);
  } finally {
    await runtime.dispose();
  }
});
