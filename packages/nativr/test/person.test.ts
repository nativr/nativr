import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let r: NativRSession;
beforeAll(async () => {
  r = await createR({ execution: "inline", assets });
});
afterAll(async () => r.dispose());

it.each([
  [
    'format(person("Ada","Lovelace",email="ada@example.invalid",role=c("aut","cre")))',
    "Ada Lovelace <ada@example.invalid> [aut, cre]",
  ],
  ["length(person())", 0],
  [
    'identical(unclass(person("Ada")),list(list(given="Ada",family=NULL,role=NULL,email=NULL,comment=NULL)))',
    true,
  ],
  [
    'format(person(given=list("Ada","Grace"),family=list("Lovelace","Hopper"),role="aut"))',
    ["Ada Lovelace [aut]", "Grace Hopper [aut]"],
  ],
  [
    'local({x<-c(person("Ada"),NULL,person("Grace"));c(x[[2]]$given,x[1]$giv,unlist(x[,"given"]))})',
    ["Grace", "Ada", "Ada", "Grace"],
  ],
  [
    'format(person("Ada",comment=c(ORCID="0000-0002-1825-0097",note="hi")))',
    "Ada (ORCID: <https://orcid.org/0000-0002-1825-0097>, note: hi)",
  ],
  [
    'format(person("Ada","Lovelace",role="aut"),include=c("family","given"),braces=list(family=c("",",")))',
    "Lovelace, Ada",
  ],
  ['as.character(person("Ada","Lovelace"))', "Ada Lovelace"],
  [
    'c("c.person" %in% getNamespaceExports("utils"),exists("c.person",globalenv()),is.function(utils:::c.person))',
    [false, false, true],
  ],
])("supports person metadata: %s", async (code, expected) => {
  expect(await r.eval(code)).toEqual(expected);
});

it("keeps private methods registered through utils detachment and reset", async () => {
  await r.eval('detach("package:utils")');
  expect(await r.eval('format(c(utils::person("Ada"),utils::person("Grace")))')).toEqual([
    "Ada",
    "Grace",
  ]);
  await r.reset();
  expect(await r.eval('as.character(person("Ada"))')).toBe("Ada");
});

it("retains explicit boundaries for formatting styles", async () => {
  await expect(r.eval('format(person("Ada"),style="R")')).rejects.toMatchObject({
    code: "NRU6313",
  });
});

it("rejects class-specific field coercion and public access to private methods", async () => {
  await expect(r.eval('person(structure(1,class="fixture"))')).rejects.toMatchObject({
    code: "NRU6313",
  });
  await expect(r.eval("utils::c.person")).rejects.toThrow();
});

it("trims field boundaries while retaining interior whitespace and comment names", async () => {
  expect(
    await r.eval(
      'local({p<-person(c(" Ada ","Augusta\\t"),role=" aut ",comment=c(note=" one  two\\tthree "));c(p$given,p$role,p$comment,names(p$comment))})',
    ),
  ).toEqual(["Ada", "Augusta", "aut", "one  two\tthree", "note"]);
  expect(await r.eval('person(" \\t\\r\\n ")$given')).toBeNull();
  expect(await r.eval('person("\\vAda\\f")$given')).toBe("\vAda\f");
});
