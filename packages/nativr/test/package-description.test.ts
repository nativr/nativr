import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it.each([
  "Package: fixture\n\nVersion: 1.0\n",
  "Package: fixture\n \t\nVersion: 1.0\n",
  " Package: ignored\nPackage: fixture\nVersion: 1.0\n",
  "Package: wrong\nPackage: fixture\nVersion: 1.0\n",
])("rejects malformed direct-bundle metadata %j", async (description) => {
  await expect(
    createR({
      execution: "inline",
      assets,
      packages: [{ description, namespace: "", rSources: [] }],
    }),
  ).rejects.toMatchObject({ code: "NRE2229" });
});

it("loads one record with surrounding whitespace and continuation fields", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    packages: [
      {
        description: " \nPackage: fixture\nVersion: 1.0\nDescription: first\n  second\n\n \t\n",
        namespace: "export(value)",
        rSources: [{ path: "R/value.R", source: "value <- 42" }],
      },
    ],
  });
  try {
    expect(await runtime.eval("fixture::value")).toBe(42);
  } finally {
    await runtime.dispose();
  }
});
