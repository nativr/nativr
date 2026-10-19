import { createHash } from "node:crypto";

const states = ["match", "mismatch", "unknown", "active", "missing", "noncallable"];

/** Probes come from collectDocumentationProbes: public Rd signatures with NULL bodies. */
export async function observePackageDocumentation(name, probes, options) {
  const source = `base::local({
    ns <- base::asNamespace(${JSON.stringify(name)})
    exported <- base::getNamespaceExports(${JSON.stringify(name)})
    if (base::length(exported) > 10000L) base::stop("Export observation limit")
    encoded <- base::vapply(exported, function(n) base::paste(base::as.character(base::charToRaw(base::enc2utf8(n))),collapse=""), "")
    blank <- base::formals(function(x) NULL)
    same <- function(a, b, depth=0L) {
      if (depth > 32L) base::stop("Signature syntax observation limit")
      compound <- function(x) base::is.pairlist(x) || base::is.call(x) || base::is.expression(x)
      allowed <- function(x) compound(x) || base::is.null(x) || base::is.symbol(x) ||
        (base::is.atomic(x) && !base::is.raw(x) && base::length(x)==1L && base::is.null(base::attributes(x)))
      if (!allowed(a) || !allowed(b)) base::stop("Unsupported signature object")
      if (base::identical(a,b)) return(TRUE)
      if (compound(a) || compound(b)) {
        if (base::typeof(a) != base::typeof(b) || base::length(a) != base::length(b) ||
            !base::identical(base::names(a),base::names(b))) return(FALSE)
        for (i in base::seq_len(base::length(a))) {
          ma <- base::identical(a[[i]],blank[[1L]])
          mb <- base::identical(b[[i]],blank[[1L]])
          if (ma || mb) { if (ma != mb) return(FALSE) }
          else if (!same(a[[i]],b[[i]],depth+1L)) return(FALSE)
        }
        return(TRUE)
      }
      if (base::is.atomic(a) && base::is.atomic(b) && base::length(a)==1L && base::length(b)==1L) {
        if (base::is.na(a) && base::is.na(b)) return(!base::is.character(a) && !base::is.character(b) && base::identical(base::is.nan(a),base::is.nan(b)))
        if ((base::is.integer(a) || base::is.double(a)) && (base::is.integer(b) || base::is.double(b)))
          return(base::identical(base::as.double(a),base::as.double(b)))
      }
      base::identical(a,b)
    }
    inspect <- function(name, documented, classes=NULL) base::tryCatch({
      env <- ns
      while (!base::identical(env, base::emptyenv()) && !base::exists(name, envir=env, inherits=FALSE)) env <- base::parent.env(env)
      if (base::identical(env, base::emptyenv())) return("missing")
      if (base::bindingIsActive(name, env)) return("active")
      if (base::is.null(classes)) {
        target <- base::get(name, envir=env, inherits=FALSE)
      } else {
        if (base::length(classes)==0L || base::any(classes=="")) return("unknown")
        target <- methods::getMethod(name, signature=classes, optional=TRUE, where=ns)
        if (base::is.null(target)) return("missing")
        target <- methods::unRematchDefinition(target)
      }
      if (!base::is.function(target)) return("noncallable")
      signature <- base::args(target)
      if (!base::is.function(signature)) return("unknown")
      if (!base::identical(base::body(signature),NULL)) return("unknown")
      if (same(base::formals(signature), base::formals(documented))) "match" else "mismatch"
    }, error=function(e) "unknown")
    observed <- base::c(${probes.map((probe) => (probe.signature === null ? '"unknown"' : `inspect(${JSON.stringify(probe.method?.generic ?? probe.name)}, ${probe.signature}${probe.method === undefined ? "" : probe.method.classes.length === 0 ? ",base::character(0)" : `,base::c(${probe.method.classes.map((name) => JSON.stringify(name)).join(",")})`})`)).join(",")})
    base::cat("\nNATIVR_DOCUMENTATION_BEGIN\n", base::length(encoded), "\n", sep="")
    for (name in encoded) base::cat(name,"\n",sep="")
    base::cat(base::paste(observed,collapse="|"),"\nNATIVR_DOCUMENTATION_END\n",sep="")
    base::invisible(NULL)
  })`;
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", exports: null, states: null };
      if (typeof result.stdout !== "string" || result.stdout.length > 2 * 1024 * 1024)
        throw new Error("Invalid metadata output");
      const marker =
        /(?:^|\n)NATIVR_DOCUMENTATION_BEGIN\n([\s\S]*)\nNATIVR_DOCUMENTATION_END\n$/u.exec(
          result.stdout.replaceAll("\r\n", "\n"),
        );
      if (marker === null) throw new Error("Incomplete metadata frame");
      const lines = marker[1].replaceAll("\r\n", "\n").split("\n");
      const count = lines.shift();
      if (
        !/^(?:0|[1-9]\d{0,4})$/u.test(count) ||
        Number(count) > 10000 ||
        lines.length !== Number(count) + 1
      )
        throw new Error("Invalid export count");
      const observed = probes.length === 0 && lines.at(-1) === "" ? [] : lines.at(-1).split("|");
      if (observed.length !== probes.length || observed.some((state) => !states.includes(state)))
        throw new Error("Invalid signature states");
      const exported = lines
        .slice(0, -1)
        .map((hex) => {
          if (!/^(?:[a-f0-9]{2}){1,4096}$/u.test(hex)) throw new Error("Invalid export encoding");
          const name = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
            Buffer.from(hex, "hex"),
          );
          if (name.includes("\0")) throw new Error("Invalid export name");
          return name;
        })
        .sort();
      if (new Set(exported).size !== exported.length) throw new Error("Duplicate export names");
      return { status: "completed", exports: exported, states: observed };
    } catch {
      return { status: "invalid-output", exports: null, states: null };
    }
  };
  const actual = await capture(options.actual);
  const expected = await capture(options.expected);
  const exportsStatus =
    actual.exports === null || expected.exports === null
      ? "unexecuted"
      : JSON.stringify(actual.exports) === JSON.stringify(expected.exports)
        ? "passed"
        : "failed";
  return {
    schemaVersion: 1,
    policy: "loaded-documentation-signatures-v2",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    actual,
    expected,
    exportsStatus,
    functions: probes.map((probe, index) => {
      const pair = [actual.states?.[index], expected.states?.[index]];
      const status = pair.some((state) => state !== "match" && state !== "mismatch")
        ? "unexecuted"
        : pair.every((state) => state === "match")
          ? "passed"
          : "failed";
      return { id: probe.id, status };
    }),
    limitations: [
      "Only exported names and comparisons with documented signatures are observed; function bodies and default expressions are never returned.",
      "Defaults are compared as unevaluated syntax with exact numeric values, integer/double storage equivalence and numeric/logical typed NA equivalence; character NA and NaN remain distinct. Non-syntax objects, deep syntax, active bindings, absent or unknown signatures and failed observations remain unexecuted.",
      "This is signature and export evidence, not complete Rd, namespace, or runtime equivalence.",
      "S4 methods are resolved by exact generic/class signature and unRematchDefinition through public APIs; unavailable method reflection remains unexecuted. Ordinary bindings and generic wrappers are not substitutes for method evidence.",
    ],
  };
}
