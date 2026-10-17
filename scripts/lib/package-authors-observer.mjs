import { createHash } from "node:crypto";
import { packageEmailPattern } from "./package-author-validation.mjs";

/** Execute the metadata expression unchanged in each caller-provided fresh session. */
export async function observePackageAuthors(expression, options) {
  if (!expression?.trim()) return null;
  const emailPattern = `^${packageEmailPattern}$`;
  const source = `base::local({
    people <- base::eval(base::parse(text=${JSON.stringify(expression)}),envir=base::new.env())
    valid <- base::inherits(people,"person") && base::is.list(people)
    author <- FALSE
    maintainer <- FALSE
    if (valid) {
      records <- base::unclass(people)
      named <- function(p) (base::length(p$given) + base::length(p$family) > 0L) &&
        base::any(base::grepl("[^ \\t\\r\\n\\f\\v]",base::c(p$given,p$family)))
      authors <- base::vapply(records,function(p) base::length(p$role) > 0L && named(p),TRUE)
      creators <- base::vapply(records,function(p) "cre" %in% p$role,TRUE)
      author <- base::any(authors)
      if (base::sum(creators) == 1L) {
        p <- records[[base::which(creators)]]
        maintainer <- named(p) && base::length(p$email) > 0L &&
          base::grepl(${JSON.stringify(emailPattern)},p$email[[1L]],perl=TRUE)
      }
    }
    base::cat("\\nNATIVR_AUTHORS:",base::paste(base::as.integer(base::c(valid,author,maintainer)),collapse="|"),"\\n",sep="")
    base::invisible(NULL)
  })`;
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", state: null };
      const marker = /(?:^|\r?\n)NATIVR_AUTHORS:([01]\|[01]\|[01])\r?\n$/u.exec(result.stdout);
      return marker === null
        ? { status: "invalid-output", state: null }
        : { status: "completed", state: marker[1] };
    } catch {
      return { status: "failed", state: null };
    }
  };
  const actual = await capture(options.actual);
  const expected = await capture(options.expected);
  return {
    schemaVersion: 1,
    policy: "authors-person-roles-v2",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    actual,
    expected,
    outcome:
      actual.status !== "completed" || expected.status !== "completed"
        ? "incomplete"
        : actual.state === expected.state
          ? "match"
          : "mismatch",
    valid: actual.state === "1|1|1" && expected.state === "1|1|1",
    limitations: [
      "Checks person shape, a named role-bearing author, and exactly one named cre with a syntactically bounded first email; this does not validate all person fields, RFC email syntax, deliverability, or full DESCRIPTION metadata.",
      "Formatting of derived Author/Maintainer text, warning equivalence, and conflicts with explicit fields remain unexecuted. Failed evaluation is incomplete evidence, not proof of invalid metadata.",
    ],
  };
}
