import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("exposes file.exists as a closure-shaped variadic base function", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(
        "c(typeof(file.exists), is.primitive(file.exists), names(formals(file.exists)))",
      ),
    ).resolves.toEqual(["closure", "FALSE", "..."]);
  } finally {
    await runtime.dispose();
  }
});
