import { expect, it } from "vitest";
import { createParser } from "../../parser/src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "compares string escape admission with GNU R without reading implementation bodies",
  async () => {
    const inputs = [
      '"\\1\\12\\1017"',
      '"\\x1z"',
      '"\\u41"',
      '"\\u{41}"',
      '"\\U{1f642}"',
      '"\\uD834\\uDD1E"',
      'r"-(a\\n)-"',
      '"\\400"',
      '"\\0"',
      '"\\u0000"',
      '"\\q"',
      '"\\x"',
      '"\\u{}"',
      '"\\U110000"',
      '"\\x41\\u42"',
      "`\\u41`",
    ];
    const parser = await createParser({
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    });
    try {
      const expected =
        inputs
          .map((source) =>
            Number(!parser.parse(source).diagnostics.some((x) => x.severity === "error")),
          )
          .join("|") + "|";
      const source = `for (text in c(${inputs.map((x) => JSON.stringify(x)).join(",")})) cat(as.integer(tryCatch({parse(text=text);TRUE},error=function(e)FALSE)),"|",sep="")`;
      const result = await capturePackageOracleScript({
        source,
        rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      });
      expect(result.status, result.stderr).toBe("completed");
      expect(result.stdout).toBe(expected);
    } finally {
      parser.dispose();
    }
  },
);
