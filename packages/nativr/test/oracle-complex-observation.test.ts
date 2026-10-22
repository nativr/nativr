import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

it("retains whole complex NA and signed-zero component tokens", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(`${observer}
local({
      token<-function(x)nativr_oracle_observe_graph(x)$graph[[1]]$values[[1]]
      c(identical(token(NA_complex_),list(kind="complex-na")),
        identical(token(complex(real=-0,imaginary=1)),list(kind="complex-components",real=list(kind="double-negative-zero"),imaginary=list(kind="double",value=1))),
        identical(token(complex(real=1,imaginary=-0)),list(kind="complex-components",real=list(kind="double",value=1),imaginary=list(kind="double-negative-zero"))))
    })`),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "pins native mixed-NA tokens without claiming runtime component storage parity",
  () => {
    const result = spawnSync(
      process.env.NATIVR_RSCRIPT ?? "Rscript",
      [
        "--vanilla",
        fileURLToPath(
          new URL("../../../conformance/oracle-v2-complex-token-fixtures.R", import.meta.url),
        ),
        fileURLToPath(new URL("../../../conformance/oracle-v2-observer.R", import.meta.url)),
      ],
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(
      "PASS complex component-token preflight (49 pairs; whole NA retained)",
    );
  },
);
