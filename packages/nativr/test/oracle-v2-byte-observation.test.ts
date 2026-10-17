import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

it("observes byte-marked character payloads and list tags without decoding bytes", async () => {
  const observer = await readFile(
    new URL("../../../conformance/oracle-v2-observer.R", import.meta.url),
    "utf8",
  );
  const r = await createR({ execution: "inline", assets });
  try {
    await r.eval(`${observer}\nNULL`);
    expect(
      await r.eval(`local({
      bytes<-rawToChar(as.raw(c(233,255)));Encoding(bytes)<-"bytes"
      expected<-list(kind="character-bytes",encoding="bytes",bytes=list(233L,255L))
      scalar<-nativr_oracle_observe_graph(c(bytes,NA_character_))
      named<-nativr_oracle_observe_graph(setNames(list(1L),bytes))
      latin<-rawToChar(as.raw(233));Encoding(latin)<-"latin1"
      text<-nativr_oracle_observe_graph(latin)
      c(identical(scalar$graph[[1]]$values[[1]],expected),
        identical(scalar$graph[[1]]$values[[2]],list(kind="character-na")),
        identical(named$graph[[1]]$tags[[1]],expected),
        identical(named$graph[[2]]$values[[1]],expected),
        identical(text$graph[[1]]$values[[1]],list(kind="character",value=latin)))
      })`),
    ).toEqual(Array(5).fill(true));
  } finally {
    await r.dispose();
  }
});
