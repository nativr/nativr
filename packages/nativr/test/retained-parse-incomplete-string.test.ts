import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
// Independently authored and native-verified; a separate adjunct to the frozen nine/six.
// Source SHA256: 3b999a77b17b58074b04de1421834ba808d50f61c16fe307deb178fc5cb729bb
it("reports an incomplete quoted string at its opening and preserves partial parse data", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(
      'local({sf<-srcfilecopy("owned.R","owned",timestamp=0,isFile=FALSE);sf$parseData<-71L;message<-tryCatch({parse(text=c("17L",\'"owned\'),keep.source=TRUE,srcfile=sf);NULL},error=function(e)conditionMessage(e));identical(message,"owned.R:2:1: unexpected INCOMPLETE_STRING\\n1: 17L\\n2: \\"owned\\n   ^")&&identical(attr(sf$parseData,"tokens"),c("NUM_CONST","expr"))})',
    );
    expect(result.value).toBe(true);
    expect(result.visible).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.output).toEqual([]);
    expect(result.topLevelErrors).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

const quoteVariants = [
  {
    input: '"owned',
    code: 'tryCatch(parse(text="\\"owned",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: '<text>:1:1: unexpected INCOMPLETE_STRING\n1: "owned\n    ^',
    sourceSha256: "f569661410ff7f3d92db8fc117c0d991e5ae935abec9d4ae0d3178b2712426c4",
  },
  {
    input: "'owned",
    code: 'tryCatch(parse(text="\'owned",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: "<text>:1:1: unexpected INCOMPLETE_STRING\n1: 'owned\n    ^",
    sourceSha256: "b9825d202a89498f5e91052831e06acf1435edc72f2b907604f07ac2345db9e8",
  },
  {
    input: "`owned",
    code: 'tryCatch(parse(text="`owned",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: "<text>:1:1: unexpected INCOMPLETE_STRING\n1: `owned\n    ^",
    sourceSha256: "f26b33c7f461ab7c7fb663b8a198c6ad1303204c6b2a15fccae11f17be9b448f",
  },
  {
    input: 'r"(owned',
    code: 'tryCatch(parse(text="r\\"(owned",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: '<text>:1:1: unexpected INCOMPLETE_STRING\n1: r"(owned\n    ^',
    sourceSha256: "cae6538ba62b78f9fb4b8c15e011ca162eec9276e3dca4a46146c1d40bf3032e",
  },
  {
    input: 'R"---[owned',
    code: 'tryCatch(parse(text="R\\"---[owned",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: '<text>:1:1: unexpected INCOMPLETE_STRING\n1: R"---[owned\n    ^',
    sourceSha256: "3ef16a38e77fb856967aa34449f0317512f5322adc19cc0576eb000bdb0eb50d",
  },
  {
    input: '"owned\\',
    code: 'tryCatch(parse(text="\\"owned\\\\",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: '<text>:1:1: unexpected INCOMPLETE_STRING\n1: "owned\\\n    ^',
    sourceSha256: "174fc388933fc8318d0992f5714fa2a0d9ce789fec43b284e4fce6c9d3023695",
  },
  {
    input: "'owned\\",
    code: 'tryCatch(parse(text="\'owned\\\\",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: "<text>:1:1: unexpected INCOMPLETE_STRING\n1: 'owned\\\n    ^",
    sourceSha256: "36380b0b2f62e05e126f7dfe0ebe67cc776f02140befeb45cbf2f433c7f9b574",
  },
  {
    input: "`owned\\",
    code: 'tryCatch(parse(text="`owned\\\\",keep.source=TRUE),error=function(e)conditionMessage(e))',
    expected: "<text>:1:1: unexpected INCOMPLETE_STRING\n1: `owned\\\n    ^",
    sourceSha256: "57672e3978328738f4a12728275cb23f9ba1c8e4773d83ffd1956ee730375c0e",
  },
];
it.each(quoteVariants)(
  "reports the observed incomplete quote: $input",
  async ({ code, expected }) => {
    const runtime = await createR({ execution: "inline", assets });
    try {
      expect(await runtime.eval(code)).toBe(expected);
    } finally {
      await runtime.dispose();
    }
  },
);
