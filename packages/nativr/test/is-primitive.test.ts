import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("classifies primitive-valued base functions independently of NativR call dispatch", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        c(
          is.primitive(sum), is.primitive(\`+\`), is.primitive(quote),
          is.primitive(as.character), is.primitive(list), is.primitive(get),
          is.primitive(identity), is.primitive(is.primitive),
          is.primitive(function(x) x), is.primitive(1),
          identical(names(formals(is.primitive)), "x"), typeof(is.primitive)
        )
      `),
    ).resolves.toEqual([
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "FALSE",
      "FALSE",
      "FALSE",
      "FALSE",
      "FALSE",
      "TRUE",
      "closure",
    ]);
    await expect(runtime.eval("is.primitive()")).rejects.toMatchObject({ code: "NRE2103" });
  } finally {
    await runtime.dispose();
  }
});
