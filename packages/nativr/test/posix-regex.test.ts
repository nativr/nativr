import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
let r: NativRSession;
beforeAll(async () => {
  r = await createR({
    execution: "inline",
    assets: {
      treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
      rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
    },
  });
});
afterAll(async () => r.dispose());
it.each([
  ["space", 'c(" ","\\t","\\n","A")', [true, true, true, false]],
  ["alnum", 'c("a","Z","3","_")', [true, true, true, false]],
  ["alpha", 'c("a","Z","3","_")', [true, true, false, false]],
  ["blank", 'c(" ","\\t","\\n","A")', [true, true, false, false]],
  ["cntrl", 'c("\\t","\\u007f"," ","A")', [true, true, false, false]],
  ["digit", 'c("0","9","a"," ")', [true, true, false, false]],
  ["graph", 'c("!","~"," ","\\t")', [true, true, false, false]],
  ["lower", 'c("a","z","A","3")', [true, true, false, false]],
  ["print", 'c(" ","~","\\t","\\u007f")', [true, true, false, false]],
  ["punct", 'c("_","-","[","a")', [true, true, true, false]],
  ["upper", 'c("A","Z","a","3")', [true, true, false, false]],
  ["xdigit", 'c("0","F","f","g")', [true, true, true, false]],
])("matches the C-locale POSIX %s class", async (name, vector, expected) => {
  for (const perl of ["FALSE", "TRUE"])
    expect(await r.eval(`grepl("^[[:${name}:]]$",${vector},perl=${perl})`)).toEqual(expected);
});
it("composes classes with negation, literals, quantifiers and a leading closing bracket", async () => {
  expect(
    await r.eval('grepl("^[^[:space:]@<>]+@[[:alnum:].-]+$",c("a@b.invalid","a b@c","a@"))'),
  ).toEqual([true, false, false]);
  expect(await r.eval('grepl("^[][:digit:]-]+$",c("]2-","a","3"))')).toEqual([true, false, true]);
  expect(await r.eval('grepl("^[^][:digit:]]+$",c("ab","]","1"))')).toEqual([true, false, false]);
});
it("shares translation across replacement, splitting and match locations", async () => {
  expect(await r.eval('gsub("[[:space:]]+","-","one \\ttwo\\nthree")')).toBe("one-two-three");
  expect(await r.eval('unlist(strsplit("a,b;c","[[:punct:]]"))')).toEqual(["a", "b", "c"]);
  expect(await r.eval('as.integer(regexpr("[[:digit:]]+","ab12"))')).toBe(3);
  expect(await r.eval('regmatches("ab12 cd3",gregexpr("[[:digit:]]+","ab12 cd3"))')).toEqual([
    ["12", "3"],
  ]);
});
it("retains fixed matching and rejects unsupported bracket constructs", async () => {
  expect(await r.eval('grepl("[[:space:]]",c("[[:space:]]"," "),fixed=TRUE)')).toEqual([
    true,
    false,
  ]);
  for (const pattern of ["[[:unknown:]]", "[[.ch.]]", "[[=a=]]"])
    await expect(r.eval(`grepl(${JSON.stringify(pattern)},"x")`)).rejects.toMatchObject({
      code: "NRE2129",
    });
});

it("reports native-observed ASCII index metadata and omits it for Unicode input", async () => {
  expect(await r.eval('attr(regexpr("a",c("ab",NA)),"useBytes")')).toBe(true);
  expect(await r.eval('attr(regexpr("a",c("ab","\\u00e9")),"useBytes")')).toBeNull();
  expect(await r.eval('names(attributes(regexec("a","ab",perl=TRUE)[[1]]))')).toEqual([
    "match.length",
    "useBytes",
    "index.type",
  ]);
  expect(await r.eval('names(attributes(gregexpr("a",NA_character_)[[1]]))')).toBe("match.length");
});
