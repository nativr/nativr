import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Independent GNU R 4.6.1 observations of direct UseMethod completion.
// Active loop contexts have a separate suite; evaluation/forced-argument restrictions remain open.
const cases = [
  [
    "return skips following statements",
    'local({\n    g<-function(x){UseMethod("g");stop("continued")};g.default<-function(x)7L\n    identical(g(1L),7L)\n  })',
  ],
  [
    "return skips pending arithmetic",
    'local({\n    g<-function(x)100L+UseMethod("g");g.default<-function(x)7L\n    identical(g(1L),7L)\n  })',
  ],
  [
    "return skips pending assignment",
    'local({\n    value<-0L;g<-function(x){value<<-UseMethod("g");99L};g.default<-function(x)7L\n    identical(g(1L),7L)&&identical(value,0L)\n  })',
  ],
  [
    "if branch returns from generic",
    'local({\n    g<-function(x){if(TRUE){UseMethod("g");stop("branch continued")};99L};g.default<-function(x)7L\n    identical(g(1L),7L)\n  })',
  ],
  [
    "invisible method result",
    'local({\n    g<-function(x)UseMethod("g");g.default<-function(x)invisible(7L);v<-withVisible(g(1L))\n    identical(v,list(value=7L,visible=FALSE))\n  })',
  ],
  [
    "visible method result",
    'local({\n    g<-function(x)UseMethod("g");g.default<-function(x)7L;v<-withVisible(g(1L))\n    identical(v,list(value=7L,visible=TRUE))\n  })',
  ],
  [
    "assignment method result invisible",
    'local({\n    g<-function(x)UseMethod("g");g.default<-function(x){x<-7L};v<-withVisible(g(1L))\n    identical(v,list(value=7L,visible=FALSE))\n  })',
  ],
  [
    "explicit invisible method return",
    'local({\n    g<-function(x)UseMethod("g");g.default<-function(x){return(invisible(7L));stop("continued")};v<-withVisible(g(1L))\n    identical(v,list(value=7L,visible=FALSE))\n  })',
  ],
  [
    "invisible null method return",
    'local({\n    g<-function(x)UseMethod("g");g.default<-function(x)invisible(NULL);v<-withVisible(g(1L))\n    identical(v,list(value=NULL,visible=FALSE))\n  })',
  ],
  [
    "enclosing caller continues",
    'local({\n    g<-function(x){UseMethod("g");stop("generic continued")};g.default<-function(x)invisible(7L)\n    f<-function(){v<-g(1L);v+1L};identical(withVisible(f()),list(value=8L,visible=TRUE))\n  })',
  ],
  [
    "generic cleanup after method",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g");trace<<-c(trace,"continued");99L}\n    g.default<-function(x){trace<<-c(trace,"method");7L};v<-g(1L)\n    identical(v,7L)&&identical(trace,c("method","generic"))\n  })',
  ],
  [
    "method cleanup before generic",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g");99L}\n    g.default<-function(x){on.exit(trace<<-c(trace,"method-exit"));trace<<-c(trace,"method");7L};v<-g(1L)\n    identical(v,7L)&&identical(trace,c("method","method-exit","generic"))\n  })',
  ],
  [
    "cleanup expression preserves invisibility",
    'local({\n    trace<-character();g<-function(x){on.exit({trace<<-c(trace,"generic");100L});UseMethod("g")}\n    g.default<-function(x){on.exit({trace<<-c(trace,"method");200L});invisible(7L)};v<-withVisible(g(1L))\n    identical(v,list(value=7L,visible=FALSE))&&identical(trace,c("method","generic"))\n  })',
  ],
  [
    "generic cleanup return overrides result",
    'local({\n    g<-function(x){on.exit(return(invisible(9L)));UseMethod("g");99L};g.default<-function(x)7L\n    identical(withVisible(g(1L)),list(value=9L,visible=FALSE))\n  })',
  ],
  [
    "method cleanup return overrides result",
    'local({\n    g<-function(x){UseMethod("g");99L};g.default<-function(x){on.exit(return(invisible(9L)));7L}\n    identical(withVisible(g(1L)),list(value=9L,visible=FALSE))\n  })',
  ],
  [
    "generic cleanup error overrides result",
    'local({\n    trace<-character();g<-function(x){on.exit({trace<<-c(trace,"generic");stop("owned cleanup")});UseMethod("g")}\n    g.default<-function(x){trace<<-c(trace,"method");7L};v<-tryCatch(g(1L),error=function(e)conditionMessage(e))\n    identical(v,"owned cleanup")&&identical(trace,c("method","generic"))\n  })',
  ],
  [
    "method error runs both cleanups",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g");99L}\n    g.default<-function(x){on.exit(trace<<-c(trace,"method"));stop("owned method")}\n    v<-tryCatch(g(1L),error=function(e){trace<<-c(trace,"handler");conditionMessage(e)})\n    identical(v,"owned method")&&identical(trace,c("method","generic","handler"))\n  })',
  ],
  [
    "method cleanup error runs generic cleanup",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g");99L}\n    g.default<-function(x){on.exit({trace<<-c(trace,"method");stop("owned method cleanup")});7L}\n    v<-tryCatch(g(1L),error=function(e)conditionMessage(e))\n    identical(v,"owned method cleanup")&&identical(trace,c("method","generic"))\n  })',
  ],
  [
    "generic caller cleanup order",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g");99L};g.default<-function(x)7L\n    f<-function(){on.exit(trace<<-c(trace,"caller"));v<-g(1L);trace<<-c(trace,"caller-continued");v+1L}\n    identical(f(),8L)&&identical(trace,c("generic","caller-continued","caller"))\n  })',
  ],
  [
    "nested generics have distinct return targets",
    'local({\n    trace<-character();g<-function(x){UseMethod("g");stop("g continued")}\n    h<-function(x){UseMethod("h");stop("h continued")};h.default<-function(x){trace<<-c(trace,"h-method");3L}\n    g.default<-function(x){v<-h(x);trace<<-c(trace,"g-method-continued");v+4L}\n    identical(g(1L),7L)&&identical(trace,c("h-method","g-method-continued"))\n  })',
  ],
  [
    "method reference and attribute identity",
    'local({\n    ref<-new.env(parent=emptyenv());x<-structure(7L,note=ref);g<-function(x)UseMethod("g");g.default<-function(x)invisible(x)\n    v<-withVisible(g(x));identical(v$value,x)&&identical(attr(v$value,"note"),ref)&&identical(v$visible,FALSE)\n  })',
  ],
  [
    "unused original promise stays lazy",
    'local({\n    g<-function(x,y){UseMethod("g");y;99L};g.default<-function(x,y)7L\n    identical(g(1L,stop("unused original forced")),7L)\n  })',
  ],
  [
    "explicit selector original actual preserved",
    'local({\n    g<-function(x){UseMethod("g",1L);stop("continued")};g.integer<-function(x)invisible(x)\n    ref<-new.env(parent=emptyenv());v<-withVisible(g(ref));identical(v$value,ref)&&identical(v$visible,FALSE)\n  })',
  ],
  [
    "missing method propagates with cleanup",
    'local({\n    cleaned<-FALSE;g<-function(x){on.exit(cleaned<<-TRUE);UseMethod("owned_no_methods");99L}\n    caught<-tryCatch({g(1L);FALSE},error=function(e)TRUE);caught&&cleaned\n  })',
  ],
  [
    "nextmethod continuation remains local",
    'local({\n    g<-function(x)UseMethod("g");g.a<-function(x){v<-NextMethod();v+1L};g.default<-function(x)invisible(7L)\n    identical(withVisible(g(structure(1L,class="a"))),list(value=8L,visible=TRUE))\n  })',
  ],
  [
    "nextmethod cleanup order and continuation",
    'local({\n    trace<-character();g<-function(x){on.exit(trace<<-c(trace,"generic"));UseMethod("g")}\n    g.a<-function(x){on.exit(trace<<-c(trace,"a-exit"));v<-NextMethod();trace<<-c(trace,"a-continued");v+1L}\n    g.default<-function(x){on.exit(trace<<-c(trace,"default-exit"));7L};v<-g(structure(1L,class="a"))\n    identical(v,8L)&&identical(trace,c("default-exit","a-continued","a-exit","generic"))\n  })',
  ],
  [
    "closure alias direct call",
    'local({\n    g<-function(x){UseMethod("g");99L};g.default<-function(x)invisible(7L);alias<-g\n    identical(withVisible(alias(1L)),list(value=7L,visible=FALSE))\n  })',
  ],
  [
    "generic cleanup uses local bindings",
    'local({\n    trace<-character();g<-function(x){local_value<-"owned-local";on.exit(trace<<-c(trace,local_value));UseMethod("g");99L}\n    g.default<-function(x)7L;v<-g(1L);identical(v,7L)&&identical(trace,"owned-local")\n  })',
  ],
  [
    "helper direct generic name context",
    'local({\n    helper<-function(x){UseMethod("g");99L};g<-function(x){helper(x)+1L};g.default<-function(x)7L\n    identical(g(1L),8L)\n  })',
  ],
] as const;

it.each(cases)("direct UseMethod completion: %s", async (_name, code) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    const result = await runtime.evalDetailed(code);
    expect(result.value).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("preserves step exhaustion through method and generic cleanup returns", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxSteps: 800 } });
  try {
    await runtime.eval(
      'g<-function(x){on.exit(return(9L));UseMethod("g");99L};g.default<-function(x){on.exit(return(11L));repeat{1L}};NULL',
    );
    await expect(runtime.eval("g(1L)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval('h<-function(x)UseMethod("h");h.default<-function(x)7L;h(1L)')).toBe(
      7,
    );
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("preserves call-depth exhaustion and restores method frames", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxSteps: 100000, maxCallDepth: 12 },
  });
  try {
    await runtime.eval(
      'g<-function(x){on.exit(return(9L));UseMethod("g");99L};g.default<-function(x){on.exit(return(11L));g(x)};NULL',
    );
    await expect(runtime.eval("g(1L)")).rejects.toMatchObject({ code: "NRL4004" });
    expect(await runtime.eval('h<-function(x)UseMethod("h");h.default<-function(x)7L;h(1L)')).toBe(
      7,
    );
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
