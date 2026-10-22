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

const metadataProbe = `local({
  owner<-new.env(parent=emptyenv());owner$token<-7L
  x<-as.expression(list(first=owner,second=2L));attr(x,"owner")<-owner
  observed<-nativr_oracle_observe_graph(x);node<-observed$graph[[observed$root]]
  copied<-x;names(copied)<-c("same","same")
  duplicated<-nativr_oracle_observe_graph(copied)$graph[[1L]]
  names(copied)<-c(NA_character_,"")
  missing<-nativr_oracle_observe_graph(copied)$graph[[1L]]
  c(is.list(node$elements)&&is.null(names(node$elements)),
    identical(node$tags,list("first","second")),
    identical(lapply(node$attributes,function(item)item$name),list("names","owner")),
    identical(node$elements[[1L]],node$attributes[[2L]]$node),
    identical(observed$graph[[node$elements[[1L]]]]$typeof,"environment"),
    identical(observed$graph[[node$elements[[2L]]]]$values[[1L]]$value,2L),
    is.null(names(duplicated$elements))&&identical(duplicated$tags,list("same","same")),
    is.null(names(missing$elements))&&identical(missing$tags,list(NULL,"")))
})`;

it("keeps named expression edges ordered and metadata/reference edges separate", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(await r.eval(`${observer}\n${metadataProbe}`)).toEqual(Array(8).fill(true));
  } finally {
    await r.dispose();
  }
});

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "verifies named expression edge arrays and metadata with the native observer",
  async () => {
    const result = await capturePackageOracleScript({
      source: `${observer}\ncat(${metadataProbe},sep="\\n")`,
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout.replaceAll("\r\n", "\n").trimEnd()).toBe(Array(8).fill("TRUE").join("\n"));
  },
);
