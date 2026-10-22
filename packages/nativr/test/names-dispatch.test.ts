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
// Independently authored native-oracle observations. Unexpected success-path errors must escape.
const cases = [
  [
    "getter",
    "getter local class method",
    'local({names.owned<-function(x)c("first","second");identical(names(structure(1:2,class="owned")),c("first","second"))})',
  ],
  [
    "getter",
    "getter primary default for class",
    'local({names.default<-function(x)"default";identical(names(structure(1L,class="owned")),"default")})',
  ],
  [
    "getter",
    "getter plain input bypasses default",
    'local({names.default<-function(x)"default";identical(names(1L),NULL)})',
  ],
  [
    "getter",
    "getter second class method",
    'local({names.second<-function(x)"second";identical(names(structure(1L,class=c("first","second"))),"second")})',
  ],
  [
    "next-method",
    "getter NextMethod primitive fallback",
    'local({seen<-FALSE;names.first<-function(x){seen<<-TRUE;NextMethod()};result<-names(structure(c(a=1L),class=c("first","other")));seen&&identical(result,"a")})',
  ],
  [
    "getter",
    "getter visible method result",
    'local({names.owned<-function(x)invisible("a");identical(withVisible(names(structure(1L,class="owned"))),list(value="a",visible=TRUE))})',
  ],
  [
    "getter",
    "getter force all before arity",
    'local({events<-character();message<-err(names({events<-c(events,"x");1L},{events<-c(events,"extra");2L}));identical(list(message,events),list("2 arguments passed to \'names\' which requires 1",c("x","extra")))})',
  ],
  [
    "getter",
    "getter invalid tag",
    "identical(err(names(other=c(a=1L))),\"supplied argument name 'other' does not match 'x'\")",
  ],
  [
    "getter",
    "getter force input before extra failure",
    'identical(err(names(stop("input"),stop("extra"))),"input")',
  ],
  [
    "setter",
    "setter local class method",
    'local({`names<-.owned`<-function(x,value)structure(x,note=value);x<-structure(1:2,class="owned");names(x)<-c("a","b");identical(attributes(x),list(class="owned",note=c("a","b")))})',
  ],
  [
    "next-method",
    "setter NextMethod primitive fallback",
    'local({seen<-FALSE;`names<-.first`<-function(x,value){seen<<-TRUE;NextMethod()};x<-structure(1:2,class=c("first","other"));names(x)<-c("a","b");seen&&identical(attributes(x),list(class=c("first","other"),names=c("a","b")))})',
  ],
  [
    "setter",
    "setter visible method result",
    'local({`names<-.owned`<-function(x,value)invisible(value);identical(withVisible(`names<-`(structure(1L,class="owned"),"a")),list(value="a",visible=TRUE))})',
  ],
  [
    "setter",
    "setter force arguments before method",
    'local({events<-character();`names<-.owned`<-function(x,value)events;identical(`names<-`({events<-c(events,"x");structure(1L,class="owned")},{events<-c(events,"value");"a"}),c("x","value"))})',
  ],
  [
    "setter",
    "setter positional values despite tags",
    'identical(`names<-`(value=c(a=1L),x="b"),c(b=1L))',
  ],
  [
    "setter",
    "setter plain input bypasses default",
    'local({`names<-.default`<-function(x,value)42L;identical(`names<-`(1L,"a"),c(a=1L))})',
  ],
  [
    "metadata",
    "POSIXlt bindings and signatures",
    'exists("names.POSIXlt",asNamespace("base"),inherits=FALSE)&&exists("names<-.POSIXlt",asNamespace("base"),inherits=FALSE)&&identical(names(formals(names.POSIXlt)),"x")&&identical(names(formals(`names<-.POSIXlt`)),c("x","value"))',
  ],
  [
    "posixlt",
    "POSIXlt direct getter",
    'identical(names.POSIXlt(as.POSIXlt(c("2001-01-01","2002-02-02"),tz="UTC")),NULL)',
  ],
  [
    "posixlt",
    "POSIXlt direct setter year and balance",
    'local({x<-as.POSIXlt(c("2001-01-01","2002-02-02"),tz="UTC");x<-`names<-.POSIXlt`(x,c("a","b"));identical(list(names(x),names(unclass(x)$year),attr(x,"balanced")),list(c("a","b"),c("a","b"),NA))})',
  ],
  [
    "method-errors",
    "POSIXlt direct getter invalid type",
    'identical(err(names.POSIXlt(1L)),"$ operator is invalid for atomic vectors")',
  ],
  [
    "method-errors",
    "POSIXlt direct setter invalid type",
    'identical(err(`names<-.POSIXlt`(1L,"a")),"$ operator is invalid for atomic vectors")',
  ],
  [
    "method-errors",
    "POSIXlt direct getter missing",
    "identical(err(names.POSIXlt()),'argument \"x\" is missing, with no default')",
  ],
  [
    "method-errors",
    "POSIXlt direct setter missing value",
    'identical(err(`names<-.POSIXlt`(as.POSIXlt("2001-01-01",tz="UTC"))),\'argument "value" is missing, with no default\')',
  ],
  [
    "getter",
    "getter tag validation precedes method",
    'local({names.owned<-function(other)"method";identical(err(names(other=structure(1L,class="owned"))),"supplied argument name \'other\' does not match \'x\'")})',
  ],
  [
    "getter",
    "getter arity precedes method",
    'local({names.owned<-function(x,...)"method";identical(err(names(structure(1L,class="owned"),2L)),"2 arguments passed to \'names\' which requires 1")})',
  ],
  ["setter", "setter arbitrary tags", 'identical(`names<-`(other=1L,label="a"),c(a=1L))'],
  [
    "setter",
    "setter method retains actual tags",
    'local({`names<-.owned`<-function(x,value)list(x,value);x<-structure(1L,class="owned");identical(`names<-`(value=x,x="b"),list("b",x))})',
  ],
  [
    "setter",
    "setter arity precedes method",
    'local({`names<-.owned`<-function(x,value,...)"method";identical(err(`names<-`(structure(1L,class="owned"),"a",2L)),"3 arguments passed to \'names<-\' which requires 2")})',
  ],
  [
    "method-errors",
    "getter missing and empty arguments",
    'identical(err(names()),"0 arguments passed to \'names\' which requires 1")&&identical(err(names(,)),"argument 1 is empty")',
  ],
  [
    "method-errors",
    "setter missing and empty arguments",
    'identical(err(`names<-`(1L)),"1 argument passed to \'names<-\' which requires 2")&&identical(err(`names<-`(1L,)),"argument 2 is empty")',
  ],
  [
    "getter",
    "getter forced substitution and matched syntax",
    'local({names.owned<-function(x)list(substitute(x),deparse(match.call()),.Generic,.Group,.Method);z<-structure(1L,class="owned");identical(names(z),list(z,deparse(quote(names.owned(x=z))),"names","","names.owned"))})',
  ],
  [
    "setter",
    "setter forced substitution and matched syntax",
    'local({`names<-.owned`<-function(x,value)list(substitute(x),substitute(value),deparse(match.call()),.Generic,.Method);z<-structure(1L,class="owned");identical(`names<-`(z,c("a","b")),list(z,c("a","b"),deparse(quote(`names<-.owned`(x=z,value=c("a","b")))),"names<-","names<-.owned"))})',
  ],
  [
    "getter",
    "getter registered method and caller override",
    'local({registerS3method("names","registeredOwned",function(x)"registered",envir=baseenv());x<-structure(1L,class="registeredOwned");a<-names(x);names.registeredOwned<-function(x)"local";identical(c(a,names(x)),c("registered","local"))})',
  ],
  [
    "setter",
    "setter registered method and caller override",
    'local({registerS3method("names<-","registeredOwned",function(x,value)31L,envir=baseenv());x<-structure(1L,class="registeredOwned");a<-`names<-`(x,"a");`names<-.registeredOwned`<-function(x,value)32L;identical(c(a,`names<-`(x,"a")),c(31L,32L))})',
  ],
  [
    "next-method",
    "getter NextMethod uses reassigned input",
    'local({names.first<-function(x){x<-c(b=2L);NextMethod()};identical(names(structure(c(a=1L),class="first")),"b")})',
  ],
  [
    "next-method",
    "setter NextMethod uses reassigned value",
    'local({`names<-.first`<-function(x,value){value<-"b";NextMethod()};identical(`names<-`(structure(1L,class="first"),"a"),structure(c(b=1L),class="first"))})',
  ],
  [
    "posixlt",
    "POSIXlt named and partially named year",
    'identical(names.POSIXlt(list(year=c(a=1L))),"a")&&identical(names.POSIXlt(list(yearLong=c(a=1L))),"a")&&identical(names.POSIXlt(list(other=c(a=1L))),NULL)',
  ],
  [
    "posixlt",
    "POSIXlt year only setter preserves longer component",
    'identical(`names<-.POSIXlt`(list(year=1:2),c("a","b")),list(year=c(a=1L,b=2L)))',
  ],
  [
    "posixlt",
    "POSIXlt direct ragged list length",
    'identical(err(`names<-.POSIXlt`(list(year=1L,other=1:3),c("a","b","c"))),"\'names\' attribute [3] must be the same length as the vector [2]")',
  ],
  [
    "method-errors",
    "POSIXlt missing year and empty names errors",
    'identical(err(`names<-.POSIXlt`(list(other=1L),"a")),"cannot replicate NULL to a non-zero length")&&identical(err(`names<-.POSIXlt`(list(),character())),"attempt to set an attribute on NULL")',
  ],
  [
    "posixlt",
    "POSIXlt NULL identity and name removal",
    "identical(names.POSIXlt(NULL),NULL)&&identical(`names<-.POSIXlt`(NULL,NULL),NULL)&&identical(`names<-.POSIXlt`(list(year=c(a=1L)),NULL),list(year=1L))",
  ],
  [
    "posixlt",
    "POSIXlt environment component identity",
    'local({e<-new.env();e$year<-c(a=1L);a<-names.POSIXlt(e);r<-`names<-.POSIXlt`(e,"b");identical(list(a,identical(e,r),e$year),list("a",TRUE,c(b=1L)))})',
  ],
  [
    "posixlt",
    "POSIXlt getter uses global component method",
    'local({assign("names.yearOwned",function(x)list(substitute(x),deparse(match.call()),.Generic,.Method),globalenv());x<-structure(1L,class="yearOwned");r<-names.POSIXlt(list(year=x));rm("names.yearOwned",envir=globalenv());identical(r,list(x,deparse(quote(names.yearOwned(x=x$year))),"names","names.yearOwned"))})',
  ],
  [
    "posixlt",
    "POSIXlt setter uses global component method",
    'local({assign("names<-.yearOwned",function(x,value)list(substitute(x),substitute(value),deparse(match.call()),.Generic,.Method),globalenv());x<-structure(1L,class="yearOwned");r<-`names<-.POSIXlt`(list(year=x),"a");rm("names<-.yearOwned",envir=globalenv());identical(r,list(year=list(x,"a",deparse(quote(`names<-.yearOwned`(x=`*tmp*`,value=value))),"names<-","names<-.yearOwned")))})',
  ],
  [
    "posixlt",
    "POSIXlt getter uses global dollar method",
    'local({assign("$.dollarOwned",function(x,name)c(a=7L),globalenv());r<-names.POSIXlt(structure(list(year=1L),class="dollarOwned"));rm("$.dollarOwned",envir=globalenv());identical(r,"a")})',
  ],
  [
    "posixlt",
    "POSIXlt setter uses global dollar method",
    'local({assign("$<-.dollarOwned",function(x,name,value){attr(x,"note")<-value;x},globalenv());r<-`names<-.POSIXlt`(structure(list(year=1L),class="dollarOwned"),"a");rm("$<-.dollarOwned",envir=globalenv());identical(r,structure(list(year=1L),class="dollarOwned",note=c(a=1L)))})',
  ],
  [
    "posixlt",
    "POSIXlt local component methods remain out of library scope",
    'local({names.owned<-function(x)"local";`names<-.owned`<-function(x,value)42L;x<-structure(1L,class="owned");identical(names.POSIXlt(list(year=x)),NULL)&&identical(`names<-.POSIXlt`(list(year=x),"a"),list(year=structure(c(a=1L),class="owned")))})',
  ],
  [
    "member",
    "member ordinary class dispatch",
    'local({`$<-.owned`<-function(x,name,value){attr(x,"note")<-value;x};x<-structure(list(a=1L),class="owned");x$a<-2L;identical(x,structure(list(a=1L),class="owned",note=2L))})',
  ],
  [
    "member",
    "member nested class dispatch",
    'local({`$<-.owned`<-function(x,name,value){attr(x,"note")<-value;x};x<-list(inner=structure(list(a=1L),class="owned"));x$inner$a<-2L;identical(x,list(inner=structure(list(a=1L),class="owned",note=2L)))})',
  ],
  [
    "member",
    "member default method and plain bypass",
    'local({`$<-.default`<-function(x,name,value)42L;`$<-.list`<-function(x,name,value)43L;x<-structure(list(a=1L),class="owned");x$a<-2L;y<-list(a=1L);y$a<-2L;identical(list(x,y),list(42L,list(a=2L)))})',
  ],
  [
    "member",
    "member environment class dispatch",
    'local({`$<-.owned`<-function(x,name,value)42L;x<-new.env();class(x)<-"owned";original<-x;x$a<-2L;identical(x,42L)&&!exists("a",original,inherits=FALSE)})',
  ],
  [
    "member",
    "member method syntax and substitution",
    'local({`$<-.owned`<-function(x,name,value)list(substitute(x),substitute(name),substitute(value),deparse(match.call()),.Generic,.Method);x<-structure(list(a=1L),class="owned");x$a<-1L+2L;identical(x,list(as.name("*tmp*"),"a",quote(1L+2L),deparse(quote(`$<-.owned`(x=`*tmp*`,name=a,value=3L))),"$<-","$<-.owned"))})',
  ],
  [
    "member",
    "member NextMethod modified value",
    'local({`$<-.owned`<-function(x,name,value){value<-3L;NextMethod()};x<-structure(list(a=1L),class="owned");x$a<-2L;identical(x,structure(list(a=3L),class="owned"))})',
  ],
  [
    "member",
    "member NextMethod modified name",
    'local({`$<-.owned`<-function(x,name,value){name<-"b";NextMethod()};x<-structure(list(a=1L),class="owned");x$a<-2L;identical(x,structure(list(a=1L,b=2L),class="owned"))})',
  ],
  [
    "member",
    "member RHS errors precede missing targets",
    'identical(err(local({absent$a<-stop("rhs")})),"rhs")&&identical(err(local({absent$inner$a<-stop("rhs")})),"rhs")',
  ],
  [
    "member",
    "member assignment retains RHS invisibility",
    'local({`$<-.owned`<-function(x,name,value)42L;x<-structure(list(a=1L),class="owned");r<-withVisible(x$a<-2L);identical(list(x,r),list(42L,list(value=2L,visible=FALSE)))})',
  ],
  [
    "posixlt",
    "POSIXlt classed atomic getter dispatch",
    'local({assign("$.owned",function(x,name)c(a=7L),globalenv());on.exit(rm("$.owned",envir=globalenv()));identical(names.POSIXlt(structure(1L,class="owned")),"a")})',
  ],
  [
    "posixlt",
    "POSIXlt classed atomic setter dispatch",
    'local({assign("$.owned",function(x,name)c(a=7L),globalenv());assign("$<-.owned",function(x,name,value)list(field=name,value=value),globalenv());on.exit(rm(list=c("$.owned","$<-.owned"),envir=globalenv()));identical(`names<-.POSIXlt`(structure(1L,class="owned"),"b"),list(field="year",value=c(b=7L)))})',
  ],
  [
    "getter",
    "getter factor list library scope",
    'local({x<-structure(1L,class="factor",levels="a",names="original");names.factor<-function(x)stop("local names");identical(names(as.list.factor(x)),"original")})',
  ],
  [
    "getter",
    "getter time list library scope",
    'local({x<-structure(1,class=c("POSIXct","POSIXt"),tzone="UTC",names="original");names.POSIXct<-function(x)stop("local names");identical(names(as.list.POSIXct(x)),"original")})',
  ],
  [
    "posixlt",
    "POSIXlt year component length dispatch",
    'local({seen<-character();assign("length.yearOwned",function(x){seen<<-c(seen,"length");0L},globalenv());assign("rep_len.yearOwned",function(x,length.out){seen<<-c(seen,"rep_len");seq_len(length.out)},globalenv());on.exit(rm(list=c("length.yearOwned","rep_len.yearOwned"),envir=globalenv()));r<-`names<-.POSIXlt`(list(year=structure(1L,class="yearOwned"),other=2L),c("a","b"));identical(seen,c("length","rep_len"))&&identical(r,list(year=c(a=1L,b=2L),other=2L))})',
  ],
] as const;
it.each(cases)("%s: %s", async (_group, _name, code) => {
  await runtime.reset();
  expect(
    await runtime.eval(
      "err<-function(expr)tryCatch({expr;NULL},error=function(e)conditionMessage(e));" + code,
    ),
  ).toBe(true);
});
it("guards component allocation and recursive dispatch with session recovery", async () => {
  const limited = await createR({
    execution: "inline",
    assets,
    limits: { maxVectorLength: 64, maxSteps: 600, maxCallDepth: 1000 },
  });
  try {
    await expect(
      limited.eval(
        'length.owned<-function(x)1e9;`names<-.POSIXlt`(structure(list(year=1L),class="owned"),"a")',
      ),
    ).rejects.toMatchObject({ code: "NRL4002" });
    expect(await limited.eval("sys.nframe()")).toBe(0);
    await expect(
      limited.eval('names.owned<-function(x)names(x);names(structure(1L,class="owned"))'),
    ).rejects.toMatchObject({ code: "NRL4001" });
    expect(await limited.eval("1+1")).toBe(2);
  } finally {
    await limited.dispose();
  }
});
