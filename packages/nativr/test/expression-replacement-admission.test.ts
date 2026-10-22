import { afterAll, beforeAll, expect, it } from "vitest";
import { createR, type NativRSession } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
let runtime: NativRSession;
beforeAll(async () => {
  runtime = await createR({ execution: "inline", assets });
});
afterAll(async () => runtime.dispose());
// Independent GNU R 4.6.1 observations: replacement-admission-{matrix,native}.json.
// The 14 original input strings and hashes are retained. Success projections assert
// values and environment edges observed in their raw graphs; they add no new type claims.
const cases = [
  {
    id: "double-integer-cell-env",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-e;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "d6aed77fd255edb04cd27d82d871ddf283d9501e6cb26422c63e5739095f12c5",
    message: "incompatible types (from expression to environment) in subassignment type fix",
  },
  {
    id: "double-null-cell-env",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=NULL);before<-x;x[[1L]]<-e;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "f48a4ded2a77f23bc9d81cfc1c232779efd85ffcece5391bc7a7c4ab68147aa2",
    message: "incompatible types (from expression to environment) in subassignment type fix",
  },
  {
    id: "double-env-cell-env",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-as.expression(list(a=e));before<-x;x[[1L]]<-other;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "5896d494744cbfa2ef334f27d0ce257facbbafa6087692a1d391b33a08bb8ec2",
    message: "incompatible types (from expression to environment) in subassignment type fix",
  },
  {
    id: "double-env-list-wrapper",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-list(e);list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "bea5280572d3f7c932c1a580b25997c3aebb50e0650e663f4bfca593ec27c461",
    message: "incompatible types (from expression to list) in [[ assignment",
  },
  {
    id: "double-env-expression-wrapper",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-as.expression(list(e));list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "bb0807d8042849950c676710ce08a17e5e64df082b1fe00aa82a6a35ea79060e",
    projection:
      "is.expression(result$value)&&is.expression(result$value[[1L]])&&identical(result$value[[1L]][[1L]],result$owner)&&identical(result$source,expression(a=1L))",
  },
  {
    id: "double-closure",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-f;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "62d81d04d010664c63c16397063c46781372560f3f7cb677607d3658ab40ded7",
    message: "incompatible types (from expression to closure) in subassignment type fix",
  },
  {
    id: "double-closure-list-wrapper",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-list(f);list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "8e404bb0cf09773f125968f9c137eff270fd4b6974f5afb2d08eb2f2e43bde5a",
    message: "incompatible types (from expression to list) in [[ assignment",
  },
  {
    id: "double-builtin",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-sum;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "5a9f4fce52278a707d38b22061d6f91dc1c627f40b0680bf668c78b905814b82",
    message: "incompatible types (from expression to builtin) in subassignment type fix",
  },
  {
    id: "double-symbol",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-quote(owned);list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "493fc2e2e0aef5e60ad239494586c03db8ee8245fb15f6f9036feda8b179023c",
    projection:
      "identical(result$value,expression(a=owned))&&identical(result$source,expression(a=1L))",
  },
  {
    id: "double-call",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-quote(owned(2L));list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "a89262b974306a5985429aafe44d48af58bfdd04a0091b6af332df17db605db7",
    projection:
      "identical(result$value,expression(a=owned(2L)))&&identical(result$source,expression(a=1L))",
  },
  {
    id: "double-atomic-vector",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[[1L]]<-c(2L,3L);list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "1505985b3c3edaaba807cd0bd96879a77c98200743d34d43690e3f350681a102",
    projection:
      "is.expression(result$value)&&identical(result$value[[1L]],c(2L,3L))&&identical(result$source,expression(a=1L))",
  },
  {
    id: "single-env",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[1L]<-e;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "b340bf2113c9a428514bac8b035c95fb725a770a6f898a06818b2052411b5859",
    message: "incompatible types (from expression to environment) in subassignment type fix",
  },
  {
    id: "single-env-list-wrapper",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[1L]<-list(e);list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "d13f17762d7fcea41995375d68649bb1400dd121912e4e45c7ff7735d91bec84",
    projection:
      "is.expression(result$value)&&identical(result$value[[1L]],result$owner)&&identical(result$source,expression(a=1L))",
  },
  {
    id: "single-closure",
    code: "local({e<-new.env(parent=emptyenv());e$token<-1L;other<-new.env(parent=emptyenv());other$token<-2L;f<-local({n<-3L;function()n});x<-expression(a=1L);before<-x;x[1L]<-f;list(value=x,source=before,owner=e,other=other)})",
    sourceSha256: "ea0ea11649c9b53f574eef8cbe0ebdf21e3d8417de6a73a53038aaa7ea7c6d4b",
    message: "incompatible types (from expression to closure) in subassignment type fix",
  },
];
it.each(cases)("expression replacement admission: $id", async (row) => {
  await runtime.reset();
  if ("message" in row) {
    await expect(runtime.eval(row.code)).rejects.toMatchObject({
      code: "NRT3396",
      message: row.message,
    });
  } else {
    expect(await runtime.eval("local({result<-(" + row.code + ");" + row.projection + "})")).toBe(
      true,
    );
  }
});
// Session nonmutation/recovery guard; not additional GNU R fixture credit.
it("leaves expression bindings unchanged after rejected replacement and recovers", async () => {
  await runtime.reset();
  await runtime.eval("x<-expression(a=1L);e<-new.env(parent=emptyenv());NULL");
  await expect(runtime.eval("x[[1L]]<-e")).rejects.toMatchObject({ code: "NRT3396" });
  expect(await runtime.eval("identical(x,expression(a=1L))&&sys.nframe()==0L")).toBe(true);
  expect(await runtime.eval("x[1L]<-list(e);identical(x[[1L]],e)")).toBe(true);
});
