import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createR } from "../src/index.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
const observer = await readFile(
  new URL("../../../conformance/oracle-v2-observer.R", import.meta.url),
  "utf8",
);
const probe = `local({v<-nativr_oracle_observe_graph(complex(real=c(Inf,-Inf,0,1,NaN,1,NaN),imaginary=c(1,2,-Inf,Inf,1,NaN,NaN)))$graph[[1]]$values;sapply(v,function(x)paste(x$kind,x$real$kind,x$imaginary$kind,sep="|"))})`;
const expected = [
  "complex-components|double-positive-infinity|double",
  "complex-components|double-negative-infinity|double",
  "complex-components|double|double-negative-infinity",
  "complex-components|double|double-positive-infinity",
  "complex-components|double-nan|double",
  "complex-components|double|double-nan",
  "complex-components|double-nan|double-nan",
];
it("retains the sign and position of complex infinity and NaN components", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(await r.eval(`${observer}\n${probe}`)).toEqual(expected);
  } finally {
    await r.dispose();
  }
});
it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "observes identical native complex component tokens",
  async () => {
    const result = await capturePackageOracleScript({
      source: `${observer}\ncat(${probe},sep="\\n")`,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout.replaceAll("\r\n", "\n").trimEnd()).toBe(expected.join("\n"));
  },
);
