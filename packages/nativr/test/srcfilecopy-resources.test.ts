import { expect, it, vi } from "vitest";
import { EvaluationContext } from "@nativr/runtime";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Owned resource guards are separate from the frozen native assertion cohorts. They do not
// establish GNU R resource-limit parity or timed Worker cancellation responsiveness.
it("rejects a normalized line vector above its limit without changing input and recovers", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxVectorLength: 64 } });
  const source = "\n".repeat(256);
  try {
    await runtime.assign("sourceLines", source);
    await expect(
      runtime.eval('result<-srcfilecopy("owned.R",sourceLines,timestamp=0,isFile=FALSE)'),
    ).rejects.toMatchObject({ code: "NRL4002" });
    expect(await runtime.get("sourceLines")).toBe(source);
    expect(await runtime.eval('exists("result",inherits=FALSE)')).toBe(false);
    expect(
      await runtime.eval('srcfilecopy("owned.R","one\\ntwo",timestamp=0,isFile=FALSE)$lines'),
    ).toEqual(["one", "two"]);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("bounds scanning work in one long source cell even when only two lines result", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 300, maxVectorLength: 1024 },
  });
  const source = `${"a".repeat(600_000)}\n`;
  try {
    await runtime.assign("sourceLines", source);
    await expect(
      runtime.eval('srcfilecopy("owned.R",sourceLines,timestamp=0,isFile=FALSE)'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.get("sourceLines")).toBe(source);
    expect(
      await runtime.eval('srcfilecopy("owned.R","recovered",timestamp=0,isFile=FALSE)$lines'),
    ).toBe("recovered");
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("observes cancellation during source scanning and permits same-session recovery", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100_000, maxVectorLength: 1024 },
  });
  const source = `${"a".repeat(600_000)}\n`;
  let interrupted = false;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked below with the active context via call().
  const checkpoint = EvaluationContext.prototype.checkpoint;
  try {
    await runtime.assign("sourceLines", source);
    // Deliver cancellation deterministically at an existing work checkpoint. This avoids a
    // timer race while proving that the long single-cell path continues checking its token.
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
      await expect(
        runtime.eval('srcfilecopy("owned.R",sourceLines,timestamp=0,isFile=FALSE)'),
      ).rejects.toMatchObject({ code: "NRL4005" });
    } finally {
      observed.mockRestore();
    }
    expect(interrupted).toBe(true);
    expect(await runtime.get("sourceLines")).toBe(source);
    expect(
      await runtime.eval('srcfilecopy("owned.R","ready\\nagain",timestamp=0,isFile=FALSE)$lines'),
    ).toEqual(["ready", "again"]);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

// Independently observed GNU R 4.6.1 visibility adjuncts. These exact sources are not part of
// the earlier 18-case or three-case clean baselines and add no recursive evidence links.
const visibilityCases = [
  {
    id: "invisible-method-no-lf",
    code: 'local({assign("as.character.owned_lines",function(x,...)invisible("one\\ntwo"),envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));r<-withVisible(srcfilecopy("owned.R",structure("plain",class="owned_lines"),timestamp=0,isFile=FALSE));list(visible=r$visible,lines=r$value$lines)})',
    sourceSha256: "3a778766ddc83d303e154f1a3a2cbbbf998b55e0d8b43139268296e6be62cdf8",
    lines: "one\ntwo",
  },
  {
    id: "invisible-method-lf",
    code: 'local({assign("as.character.owned_lines",function(x,...)invisible("one\\ntwo"),envir=.GlobalEnv);on.exit(rm("as.character.owned_lines",envir=.GlobalEnv));r<-withVisible(srcfilecopy("owned.R",structure("raw\\nvalue",class="owned_lines"),timestamp=0,isFile=FALSE));list(visible=r$visible,lines=r$value$lines)})',
    sourceSha256: "db193758d4050f820e75dee4c246ca4b9610b7f0705c152ce6fa291f760df837",
    lines: ["one", "two"],
  },
];

it.each(visibilityCases)("returns visibly after $id", async ({ code, lines }) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toEqual([true, lines]);
    expect(result.visible).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.topLevelErrors).toEqual([]);
    expect(result.output).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
