import { expect, it } from "vitest";
import { createR } from "../src/index.js";
const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};
it("dispatches mean methods with lazy dots and a callable default", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `local({mean.fixture<-function(x,...)NextMethod();c(mean(structure(c(1,2,100),class="fixture"),trim=.4),mean.default(1:4),mean(1:3,unused=stop("unused")))})`,
      ),
    ).toEqual([2, 2.5, 2]);
    expect(
      await r.eval(
        `local({mean.fixture<-function(x,...)42;mean(structure(1,class="fixture"),trim=stop("unused"))})`,
      ),
    ).toBe(42);
    expect(
      await r.eval(
        `c(mean(1:5,.2),mean(1:4,trim=2),mean(1:3,trim=-1),mean(c(1,NA,2,100),tr=.34,na.r=TRUE))`,
      ),
    ).toEqual([3, 2.5, 2, 2]);
    const result = await r.evalDetailed(`mean("x",trim=stop("unused"))`);
    expect(result.warnings[0]?.message).toBe("argument is not numeric or logical: returning NA");
    await expect(r.eval(`mean(1+1i,trim=.1)`)).rejects.toThrow(
      "trimmed means are not defined for complex data",
    );
  } finally {
    await r.dispose();
  }
});

it("uses strict TRUE missing removal and preserves complex NaN components", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        `sapply(list(FALSE,NA,NA_real_,NULL,logical(),c(TRUE,FALSE),1,"TRUE",list(TRUE)),function(control)identical(mean(c(1,NA_real_),na.rm=control),NA_real_))`,
      ),
    ).toEqual(Array(9).fill(true));
    expect(
      await r.eval(
        `c(identical(mean(c(1,NA_real_),na.rm=TRUE),1),identical(mean(c(NaN,NA_real_)),NA_real_),identical(mean(c(NA_real_,NaN)),NA_real_),identical(mean(NA_integer_),NA_real_))`,
      ),
    ).toEqual(Array(4).fill(true));
    expect(
      await r.eval(
        `local({x<-mean(complex(real=c(NaN,1),imaginary=c(1,3)));y<-mean(complex(real=c(1,3),imaginary=c(NaN,1)));c(is.nan(Re(x)),Im(x)==2,Re(y)==2,is.nan(Im(y)))})`,
      ),
    ).toEqual(Array(4).fill(true));
  } finally {
    await r.dispose();
  }
});

it("preserves canonical numeric time classes and selected metadata in means", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'c(identical(mean(structure(c(1,2,100),class="Date"),trim=.4),structure(2,class="Date")),identical(mean(structure(c(0,3600),class=c("POSIXct","POSIXt"),tzone="UTC")),structure(1800,class=c("POSIXct","POSIXt"),tzone="UTC")),identical(mean(structure(c(1,3),class="difftime",units="hours")),structure(2,class="difftime",units="hours")))',
      ),
    ).toEqual([true, true, true]);
  } finally {
    await r.dispose();
  }
});

it("preserves time metadata through selection before mean", async () => {
  const r = await createR({ execution: "inline", assets });
  try {
    expect(
      await r.eval(
        'local({x<-structure(c(1,2),class=c("POSIXct","POSIXt"),tzone="UTC");y<-structure(c(1,2),class="difftime",units="hours");c(identical(attr(x[FALSE],"tzone"),"UTC"),identical(attr(mean(y[FALSE]),"units"),"hours"),identical(class(x[[1]]),c("POSIXct","POSIXt")),identical(y[[1]],1))})',
      ),
    ).toEqual([true, true, true, true]);
  } finally {
    await r.dispose();
  }
});
