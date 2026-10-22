import { expect, it } from "vitest";
import { createR } from "../src/index.js";

const assets = {
  treeSitterRuntimeWasm: new URL("../../parser/assets/web-tree-sitter.wasm", import.meta.url),
  rGrammarWasm: new URL("../../parser/assets/tree-sitter-r.wasm", import.meta.url),
};

// Resource-policy tests use only owned inputs. Huge requests are never sent to native R and do
// not establish native parser/error parity. Assertions check the resource category and recovery.
it("preflights sprintf expansion and cumulative formatted bytes", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxOutputBytes: 64 } });
  try {
    for (const source of [
      'sprintf("%100000000000000000000000000000d",1)',
      'sprintf("%100000000000000000000000000000s","x")',
      'sprintf("%100000000000000000000000000000f",NA_real_)',
      'sprintf("%.100000000000000000000000000000f",1)',
      'sprintf("%.100000000000000000000000000000e",1)',
      'sprintf("%.100000000000000000000000000000d",1)',
      'sprintf("%#.100000000000000000000000000000g",1)',
      'sprintf("%.40f",c(1,2))',
      'sprintf("%.40f:%.40f",1,2)',
      'sprintf(c(strrep("a",40),strrep("b",40)))',
      'sprintf(paste0(strrep("a",40),"%40s"),"x")',
      'nchar(sprintf("%80s","x"))',
      'nchar(sprintf("%.40f:%.40f",1,2))',
      'length(sprintf(c(strrep("a",40),strrep("b",40))))',
    ]) {
      await expect(runtime.eval(source)).rejects.toMatchObject({ code: "NRL4007" });
      expect(await runtime.eval('sprintf("%.2f",0.125)')).toBe("0.12");
      expect(await runtime.eval("sys.nframe()")).toBe(0);
    }
  } finally {
    await runtime.dispose();
  }
});

it("counts UTF-8 bytes across text, supplementary characters and padding", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxOutputBytes: 64 } });
  try {
    expect(
      await runtime.eval(
        'identical(sprintf("%s%3s!",strrep("é",29),"🦊"),paste0(strrep("é",29)," 🦊!"))',
      ),
    ).toBe(true);
    await expect(runtime.eval('sprintf("%s%3s!!",strrep("é",29),"🦊")')).rejects.toMatchObject({
      code: "NRL4007",
    });
    expect(await runtime.eval('sprintf("%.1s","🦊tail")')).toBe("🦊");
    expect(await runtime.eval('sprintf("%.2s","é🦊tail")')).toBe("é🦊");
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("keeps huge but nonexpanding precision paths bounded", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxOutputBytes: 64 } });
  try {
    for (const [source, expected] of [
      ['sprintf("%.100000000000000000000000000000s","short")', "short"],
      ['sprintf("%.100000000000000000000000000000g",1.25)', "1.25"],
      ['sprintf("%.100000000000000000000000000000g",1e20)', "100000000000000000000"],
      ['sprintf("%.100000000000000000000000000000f",Inf)', "Inf"],
      ['sprintf("%.100000000000000000000000000000e",NaN)', "NaN"],
      ['sprintf("%.100000000000000000000000000000d",NA_integer_)', "NA"],
      ['sprintf("%.100000000000000000000000000000x",15L)', "f"],
      ['sprintf("%100000000000000000000000000000.100000000000000000000000000000%")', "%"],
    ] as const)
      expect(await runtime.eval(source)).toBe(expected);
    expect(
      await runtime.eval(
        'identical(sprintf("%100000000000000000000000000000f",numeric()),character())',
      ),
    ).toBe(true);
    expect(await runtime.eval("is.na(sprintf(NA_character_,1))")).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

it("counts surrogate pairs formed across chunks only within the same output row", async () => {
  const runtime = await createR({ execution: "inline", assets, limits: { maxOutputBytes: 64 } });
  try {
    // These admitted JS strings contain isolated UTF-16 halves. Joining them forms one scalar.
    await runtime.assign("hi", "a".repeat(60) + "\ud83e");
    await runtime.assign("lo", "\udd8a");
    expect(await runtime.eval('nchar(sprintf("%s%s",hi,lo))')).toBe(61);
    await expect(runtime.eval('nchar(sprintf("%s%2s",hi,lo))')).rejects.toMatchObject({
      code: "NRL4007",
    });
    await expect(runtime.eval('length(sprintf("%s",c(hi,lo)))')).rejects.toMatchObject({
      code: "NRL4007",
    });
    await runtime.assign("hi", "a".repeat(59) + "\ud83e");
    expect(await runtime.eval('nchar(sprintf("%s%-2s",hi,lo))')).toBe(61);
    await expect(runtime.eval('nchar(sprintf("%s%2s",hi,lo))')).rejects.toMatchObject({
      code: "NRL4007",
    });
    expect(await runtime.eval("sys.nframe()")).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("checkpoints each directive and long invalid scanning, and recovers", async () => {
  const runtime = await createR({
    execution: "inline",
    assets,
    limits: { maxOutputBytes: 200000, maxSteps: 100, maxVectorLength: 10000 },
  });
  try {
    await runtime.assign("percentFormat", "%%".repeat(2000));
    await expect(runtime.eval("sprintf(percentFormat)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval("nchar(percentFormat)")).toBe(4000);
    await runtime.assign("invalidFormat", "%" + "0".repeat(100000) + "q");
    await expect(runtime.eval("sprintf(invalidFormat)")).rejects.toMatchObject({ code: "NRL4001" });
    expect(await runtime.eval("nchar(invalidFormat)")).toBe(100002);
    expect(await runtime.eval("sys.nframe()")).toBe(0);
    expect(await runtime.eval("1+1")).toBe(2);
  } finally {
    await runtime.dispose();
  }
});

it("preserves the existing supported grammar, passthrough and forcing", async () => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(await runtime.eval('sprintf("%% %+05d %-4s",3,"x")')).toBe("% +0003 x   ");
    expect(await runtime.eval('sprintf("%q:%d:%*s",3,"unused")')).toBe("%q:3:%*s");
    expect(await runtime.eval('sprintf("%000d %.f %0.2q%%",3,2.5)')).toBe("3 2 %0.2q%");
    expect(await runtime.eval('sprintf("%s",list(quote(x+1)))')).toBe("x + 1");
    expect(
      await runtime.eval(`local({events<-character();m<-function(k,v){events<<-c(events,k);v};
      x<-sprintf(m("format","%1000000000000f"),m("first",numeric()),m("second",1));
      identical(list(x,events),list(character(),c("format","first","second")))})`),
    ).toBe(true);
  } finally {
    await runtime.dispose();
  }
});

// Independently authored GNU R 4.6.1 observations for the preserved ordinary subset.
const parityCases = [
  {
    group: "scanner",
    name: "mixed directives and literal percent",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("prefix %% %+05d %-4s %.2f|%.1e|%.3g suffix",3L,"x",0.125,1.25,12.5),"prefix % +0003 x    0.12|1.2e+00|12.5 suffix")})',
  },
  {
    group: "scanner",
    name: "integer bases",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%d %i %x %X %o",-7L,7L,-1L,255L,8L),"-7 7 ffffffff FF 10")})',
  },
  {
    group: "scanner",
    name: "empty precision",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.f|%.e|%.g",2.5,2.5,2.5),"2|2e+00|2")})',
  },
  {
    group: "scanner",
    name: "alternate forms",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%#.0f|%#.0e|%#.3g",3,2,1),"3.|2.e+00|1.00")})',
  },
  {
    group: "scanner",
    name: "integer precision and width",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%8.4d",-7L),"   -0007")})',
  },
  {
    group: "scanner",
    name: "ASCII string precision and width",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%8.3s","abcdef"),"     abc")})',
  },
  {
    group: "recycling",
    name: "vector and format recycling",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf(c("%02d:%s","%d-%s"),1:4,c("a","b")),c("01:a","2-b","03:a","4-b"))})',
  },
  {
    group: "recycling",
    name: "formats without value arguments",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf(c("left %%","right %%")),c("left %","right %"))})',
  },
  {
    group: "nonfinite",
    name: "nonfinite flags",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%+08.2f",c(NA_real_,NaN,Inf,-Inf)),c("      NA","     NaN","    +Inf","    -Inf"))})',
  },
  {
    group: "nonfinite",
    name: "constructed signed zero",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%+08.2f",c(-1,1)/Inf),c("-0000.00","+0000.00"))})',
  },
  {
    group: "nonfinite",
    name: "missing string argument",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("[%5s]",c("x",NA_character_)),c("[    x]","[   NA]"))})',
  },
  {
    group: "boundaries",
    name: "source attrs dropped",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1f",structure(c(a=1.25,b=2.5),note="drop",class="owned")),c("1.2","2.5"))})',
  },
  {
    group: "boundaries",
    name: "empty values",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%d",integer()),character())})',
  },
  {
    group: "boundaries",
    name: "empty formats",
    code: "local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf(character(),1L),character())})",
  },
  {
    group: "boundaries",
    name: "truncate ASCII before Unicode",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.2s","ab\\u00e9\\U0001f600"),"ab")})',
  },
  {
    group: "forcing",
    name: "visible value",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(withVisible(sprintf("%d",1L)),list(value="1",visible=TRUE))})',
  },
  {
    group: "forcing",
    name: "source argument order",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(local({events<-character();m<-function(k,x){events<<-c(events,k);x};value<-sprintf(m("fmt","%d:%s"),m("first",1L),m("second","a"));list(value,events)}),list("1:a",c("fmt","first","second")))})',
  },
  {
    group: "forcing",
    name: "format fails before value",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(sprintf(stop("owned format"),stop("owned value"))),"owned format")})',
  },
  {
    group: "forcing",
    name: "empty formats still force values",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(err(sprintf(character(),stop("owned value"))),"owned value")})',
  },
  {
    group: "dyadic-precision",
    name: "fixed precision 1073",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1073f",0.125),paste0("0.125",strrep("0",1070)))})',
  },
  {
    group: "dyadic-precision",
    name: "exponent precision 1073",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1073e",0.125),paste0("1.25",strrep("0",1071),"e-01"))})',
  },
  {
    group: "dyadic-precision",
    name: "fixed precision 1074",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1074f",0.125),paste0("0.125",strrep("0",1071)))})',
  },
  {
    group: "dyadic-precision",
    name: "exponent precision 1074",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1074e",0.125),paste0("1.25",strrep("0",1072),"e-01"))})',
  },
  {
    group: "dyadic-precision",
    name: "fixed precision 1075",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1075f",0.125),paste0("0.125",strrep("0",1072)))})',
  },
  {
    group: "dyadic-precision",
    name: "exponent precision 1075",
    code: 'local({err<-function(expr)tryCatch({expr;NULL},error=conditionMessage);identical(sprintf("%.1075e",0.125),paste0("1.25",strrep("0",1073),"e-01"))})',
  },
] as const;
it.each(parityCases)("native parity $group: $name", async ({ code }) => {
  const runtime = await createR({ execution: "inline", assets });
  try {
    expect(await runtime.eval(code)).toBe(true);
  } finally {
    await runtime.dispose();
  }
});
