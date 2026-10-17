import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, NA, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let r: NativRSession;
beforeAll(async () => {
  r = await createR({ execution: "inline", assets });
});
afterAll(async () => r.dispose());

it("dispatches all Summary members with generic/group/method metadata", async () => {
  expect(
    await r.eval(
      `local({Summary.fixture<-function(...,na.rm)paste(.Generic,.Group,.Method,na.rm,missing(na.rm));x<-structure(1,class="fixture");c(sum(x),prod(x),min(x),max(x),any(x),all(x),range(x))})`,
    ),
  ).toEqual(
    ["sum", "prod", "min", "max", "any", "all", "range"].map(
      (name) => `${name} Summary Summary.fixture FALSE FALSE`,
    ),
  );
});

it("selects methods per class and only dispatches on the first data argument", async () => {
  expect(
    await r.eval(
      'local({c.fixture<-function(...)exists(".Group",inherits=FALSE);c(structure(1,class="fixture"))})',
    ),
  ).toBe(false);
  expect(
    await r.eval(
      `local({Summary.first<-function(...)"group-first";sum.second<-function(...)"specific-second";x<-structure(1,class=c("first","second"));c(sum(x),sum(1,x),sum(NULL,x))})`,
    ),
  ).toEqual(["group-first", "2", "1"]);
  expect(
    await r.eval(
      `local({sum.first<-function(...)paste(.Generic,.Group,.Method);Summary.first<-function(...)"wrong";sum(structure(1,class="first"))})`,
    ),
  ).toBe("sum  sum.first");
  expect(
    await r.eval(`local({sum.default<-function(...)99;sum(structure(1,class="absent"))})`),
  ).toBe(1);
});

it("forces arguments once before dispatch and forwards uncoerced na.rm", async () => {
  expect(
    await r.eval(
      `local({trace<-character();Summary.fixture<-function(...,na.rm)list(trace,na.rm);sum({trace<-c(trace,"first");structure(1,class="fixture")},na.rm={trace<-c(trace,"control");NA},last={trace<-c(trace,"last");2})})`,
    ),
  ).toEqual([["first", "control", "last"], NA]);
});

it("continues group methods and returns to the primitive", async () => {
  expect(
    await r.eval(
      `local({calls<-character();Summary.first<-function(...,na.rm=FALSE){calls<<-c(calls,.Method);NextMethod()};Summary.second<-function(...,na.rm=FALSE){calls<<-c(calls,.Method);NextMethod()};v<-sum(structure(1:2,class=c("first","second")),3L);list(v,calls)})`,
    ),
  ).toEqual([6, ["Summary.first", "Summary.second"]]);
  expect(
    await r.eval(
      `local({sum.first<-function(...)NextMethod();Summary.second<-function(...)99;sum(structure(1:2,class=c("first","second")),3L)})`,
    ),
  ).toBe(6);
});

it("finds namespace-registered group methods without global bindings", async () => {
  const session = await createR({
    execution: "inline",
    assets,
    packages: [
      {
        description: "Package: summaryfixture\nVersion: 1.0\n",
        namespace: "export(make)\nS3method(Summary,summaryfixture)\n",
        rSources: [
          {
            path: "R/main.R",
            source:
              'make<-function()structure(1:2,class="summaryfixture");Summary.summaryfixture<-function(...,na.rm=FALSE)paste(.Generic,.Group)',
          },
        ],
      },
    ],
  });
  try {
    expect(await session.eval("sum(summaryfixture::make())")).toBe("sum Summary");
    expect(await session.eval('exists("Summary.summaryfixture",globalenv())')).toBe(false);
  } finally {
    await session.dispose();
  }
});
