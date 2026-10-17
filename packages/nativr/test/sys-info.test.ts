import { expect, it } from "vitest";

import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("exposes stable browser system information with the R 4.6.1 named-vector shape", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    await expect(
      runtime.eval(`
        info <- Sys.info()
        c(
          typeof(info), length(info), names(info), info[["sysname"]], info[["machine"]],
          all(is.na(info[c("release", "version", "nodename", "login", "user", "effective_user", "udomain")])),
          identical(info, Sys.info()), identical(formals(Sys.info), pairlist())
        )
      `),
    ).resolves.toEqual([
      "character",
      "9",
      "sysname",
      "release",
      "version",
      "nodename",
      "machine",
      "login",
      "user",
      "effective_user",
      "udomain",
      "NativR",
      "wasm32",
      "TRUE",
      "TRUE",
      "TRUE",
    ]);
    await expect(runtime.eval("Sys.info(1)")).rejects.toMatchObject({ code: "NRE2101" });
  } finally {
    await runtime.dispose();
  }
});
