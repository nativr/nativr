import { createHash } from "node:crypto";

/** Compare independently derived text with native metadata expansion, never implementation text. */
export async function observePackageAuthorFields(expression, fields, options) {
  if (!expression?.trim()) return null;
  // Mark non-ASCII R string literals explicitly rather than relying on the oracle host locale.
  const literal = (text) =>
    JSON.stringify(text).replace(/[\u0080-\u{10ffff}]/gu, (character) => {
      const code = character.codePointAt(0);
      return code <= 0xffff
        ? `\\u${code.toString(16).padStart(4, "0")}`
        : `\\U${code.toString(16).padStart(8, "0")}`;
    });
  const declarations = `author <- ${literal(fields.author ?? "")}
    maintainer <- ${literal(fields.maintainer ?? "")}`;
  const footer = `hex <- function(x) base::paste(base::as.character(base::charToRaw(base::enc2utf8(x))),collapse="")
    base::cat("\\nNATIVR_AUTHOR_FIELDS:",hex(author),"|",hex(maintainer),"\\n",sep="")
    base::invisible(NULL)`;
  const actualSource = `base::local({
    people <- base::eval(base::parse(text=${literal(expression)}),envir=base::new.env())
    ${declarations}
    if (base::inherits(people,"person") && base::is.list(people)) {
      records <- base::unclass(people)
      named <- function(p) (base::length(p$given) + base::length(p$family) > 0L) &&
        base::any(base::grepl("[^ \\t\\r\\n\\f\\v]",base::c(p$given,p$family)))
      authors <- base::vapply(records,function(p) base::length(p$role)>0L && named(p),TRUE)
      creators <- base::vapply(records,function(p) "cre" %in% p$role,TRUE)
      ${fields.author === undefined ? 'author <- base::paste(base::gsub("[ \\t\\r\\n\\f\\v]+"," ",base::format(people[authors],include=base::c("given","family","role","comment"))),collapse=",\\n  ")' : ""}
      ${fields.maintainer === undefined ? 'if(base::sum(creators)==1L) { p <- records[[base::which(creators)]]; if(named(p) && base::length(p$email)>0L) maintainer <- base::format(people[creators],include=base::c("given","family","email"),collapse=base::list(email=FALSE)) }' : ""}
    }
    ${footer}
  })`;
  const inputs = [
    `"Authors@R"=${literal(expression)}`,
    ...(fields.encoding === undefined ? [] : [`Encoding=${literal(fields.encoding)}`]),
    ...(fields.author === undefined ? [] : [`Author=${literal(fields.author)}`]),
    ...(fields.maintainer === undefined ? [] : [`Maintainer=${literal(fields.maintainer)}`]),
  ];
  const expectedSource = `base::local({
    input <- base::c(${inputs.join(",")})
    expanded <- tools:::.expand_package_description_db_R_fields(input)
    ${declarations}
    ${fields.author === undefined ? 'author <- expanded[["Author"]]' : ""}
    ${fields.maintainer === undefined ? 'maintainer <- expanded[["Maintainer"]]' : ""}
    ${footer}
  })`;
  const capture = async (run, source) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", fields: null };
      const marker =
        /(?:^|\r?\n)NATIVR_AUTHOR_FIELDS:((?:[0-9a-f]{2})*)\|((?:[0-9a-f]{2})*)\r?\n$/u.exec(
          result.stdout,
        );
      if (marker === null) return { status: "invalid-output", fields: null };
      const decode = (hex) =>
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(hex, "hex"));
      return {
        status: "completed",
        fields: { author: decode(marker[1]), maintainer: decode(marker[2]) },
      };
    } catch {
      return { status: "failed", fields: null };
    }
  };
  const actual = await capture(options.actual, actualSource);
  const expected = await capture(options.expected, expectedSource);
  return {
    schemaVersion: 1,
    policy: "authors-derived-fields-v1",
    sourceSha256: createHash("sha256").update(actualSource).digest("hex"),
    oracleSourceSha256: createHash("sha256").update(expectedSource).digest("hex"),
    actual,
    expected,
    outcome:
      actual.status !== "completed" || expected.status !== "completed"
        ? "incomplete"
        : JSON.stringify(actual.fields) === JSON.stringify(expected.fields)
          ? "match"
          : "mismatch",
    limitations: [
      "This compares derived text and explicit-field precedence, not full metadata validity, warning equivalence, or unsupported person formatting such as ROR comments.",
    ],
  };
}
