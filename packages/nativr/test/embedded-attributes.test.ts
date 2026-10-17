import { afterEach, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession | undefined;
afterEach(async () => runtime?.dispose());
// Independently authored GNU R 4.6.1 black-box observations.
const cases = [
  {
    id: "matrix-call",
    code: 'deparse(call("f",matrix(-1:-6,3,dimnames=list(c("a","b","c"),c("x","y")))),width.cutoff=500)',
    expected: 'f(structure(-1:-6, dim = 3:2, dimnames = list(c("a", "b", "c"), c("x", "y"))))',
  },
  {
    id: "named-atomic-call",
    code: 'deparse(call("f",setNames(1:2,c("a","b"))),width.cutoff=500)',
    expected: 'f(structure(1:2, names = c("a", "b")))',
  },
  {
    id: "custom-atomic-call",
    code: 'deparse(call("f",structure(1:2,note=list(x=3),class="fixture")),width.cutoff=500)',
    expected: 'f(structure(1:2, note = list(x = 3), class = "fixture"))',
  },
  {
    id: "attributed-list-call",
    code: 'deparse(call("f",structure(list(a=1,b=2),note="x")),width.cutoff=500)',
    expected: 'f(structure(list(a = 1, b = 2), note = "x"))',
  },
  {
    id: "attr-order",
    code: 'deparse(call("f",structure(c(3,4),note="x",names=c("a","b"),class="fixture")),width.cutoff=500)',
    expected: 'f(structure(c(a = 3, b = 4), note = "x", class = "fixture"))',
  },
  {
    id: "replacement-matrix",
    code: 'local({"put<-"<-function(x,value) {stop("fixture")}; x<-1; tryCatch({put(x)<-matrix(-1:-6,3,dimnames=list(c("a","b","c"),c("x","y")))},error=function(e)deparse(conditionCall(e),width.cutoff=500))})',
    expected:
      '`put<-`(`*tmp*`, value = structure(-1:-6, dim = 3:2, dimnames = list(c("a", "b", "c"), c("x", "y"))))',
  },
  {
    id: "names-0",
    code: 'deparse(call("f",setNames(1L,"a")),width.cutoff=500)',
    expected: "f(c(a = 1L))",
  },
  {
    id: "names-1",
    code: 'deparse(call("f",setNames(c(1L,3L),c("a","b"))),width.cutoff=500)',
    expected: "f(c(a = 1L, b = 3L))",
  },
  {
    id: "names-2",
    code: 'deparse(call("f",setNames(c(1,2),c("a","b"))),width.cutoff=500)',
    expected: "f(c(a = 1, b = 2))",
  },
  {
    id: "missing-character-attribute",
    code: 'deparse(call("f",structure(c(1,2),note=c("",NA_character_))),width.cutoff=500)',
    expected: 'f(structure(c(1, 2), note = c("", NA)))',
  },
  {
    id: "names-4",
    code: 'deparse(call("f",setNames(integer(),character())),width.cutoff=500)',
    expected: "f(structure(integer(0), names = character(0)))",
  },
  {
    id: "names-5",
    code: 'deparse(call("f",structure(list(a=1),class="fixture",names="b")),width.cutoff=500)',
    expected: 'f(structure(list(b = 1), class = "fixture"))',
  },
  {
    id: "names-6",
    code: 'deparse(call("f",structure(pairlist(a=1),note="x")),width.cutoff=500)',
    expected: 'f(structure(pairlist(a = 1), note = "x"))',
  },
  {
    id: "names-7",
    code: 'deparse(call("f",setNames(c(TRUE,FALSE),c("a","b"))),width.cutoff=500)',
    expected: "f(c(a = TRUE, b = FALSE))",
  },
];
it.each(["deparse(x)", "deparse1(x)", "deparse(as.expression(list(x)))"])(
  "bounds constructed syntax through %s and leaves the session usable",
  async (source) => {
    runtime = await createR({ execution: "inline", assets });
    await runtime.eval('x <- quote(a); for(i in 1:600) x <- call("f", x); invisible(NULL)');
    await expect(runtime.eval(source)).rejects.toMatchObject({ code: "NRL4004" });
    expect(await runtime.eval("1 + 1")).toBe(2);
  },
);

it.each(cases)("$id", async ({ code, expected }) => {
  runtime = await createR({ execution: "inline", assets });
  expect(await runtime.eval(code)).toEqual(expected);
});

it.each([
  { value: "matrix(-1:-6,3)", diagnostic: "-1:-6", reflected: "structure(-1:-6, dim = 3:2)" },
  {
    value: 'setNames(c(1,2),c("a","b"))',
    diagnostic: "c(a = 1, b = 2)",
    reflected: "c(a = 1, b = 2)",
  },
  {
    value: 'structure(list(a=1),note="x")',
    diagnostic: "list(a = 1)",
    reflected: 'structure(list(a = 1), note = "x")',
  },
])(
  "separates stored attributes from diagnostic display for $value",
  async ({ value, diagnostic, reflected }) => {
    runtime = await createR({ execution: "inline", assets });
    await runtime.eval(
      "observed <- character(); globalCallingHandlers(error = function(e) observed <<- deparse(conditionCall(e), width.cutoff = 500))",
    );
    const result = await runtime.evalDetailed(
      `options(error = function() invisible(NULL)); "put<-" <- function(x,value) stop("fixture"); x <- 1; put(x) <- ${value}; invisible(NULL)`,
      { topLevelErrorHandling: "option" },
    );
    expect(
      result.output
        .filter((event) => event.stream === "stderr")
        .map((event) => event.text)
        .join(""),
    ).toBe(`Error in \`put<-\`(\`*tmp*\`, value = ${diagnostic}) : fixture\n`);
    expect(await runtime.get("observed")).toBe(`\`put<-\`(\`*tmp*\`, value = ${reflected})`);
  },
);
