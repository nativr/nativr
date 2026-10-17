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
const probe = `local({
  as.list.expression<<-function(...)stop("observer must bypass generic conversion")
  as.vector.expression<<-function(...)stop("observer must bypass implicit conversion")
  value<-list(unlist(list(expression(a,1+2),3),recursive=FALSE,use.names=FALSE),
              unlist(list(expression(),integer()),recursive=FALSE))
  graph<-nativr_oracle_observe_graph(value)$graph
  sapply(graph,function(node)paste(node$id,node$typeof,node$length,length(node$attributes),
    paste(unlist(node$elements),collapse=","),if(is.null(node$name))"" else node$name,
    if(is.null(node$values))"" else paste(sapply(node$values,function(cell)paste(cell$kind,cell$value,sep="=")),collapse=";"),sep="|"))
})`;
const expected = [
  "1|list|2|0|2,9||",
  "2|expression|3|0|3,4,8||",
  "3|symbol|1|0||a|",
  "4|language|3|0|5,6,7||",
  "5|symbol|1|0||+|",
  "6|double|1|0|||double=1",
  "7|double|1|0|||double=2",
  "8|double|1|0|||double=3",
  "9|expression|0|0|||",
];

it("observes nonempty and empty expression payloads through default list conversion", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(await r.eval(`${observer}\n${probe}`)).toEqual(expected);
  } finally {
    await r.dispose();
  }
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "observes identical native expression graph tokens",
  async () => {
    const result = await capturePackageOracleScript({
      source: `${observer}\ncat(${probe},sep="\\n")`,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout.replaceAll("\r\n", "\n").trimEnd()).toBe(expected.join("\n"));
  },
);
