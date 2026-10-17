import { createHash } from "node:crypto";

/**
 * Load and attach a package from an explicit lib.loc after removing its library from .libPaths(),
 * matching the documented R CMD check item "loading without being on the library search path".
 */
export async function observeLibraryPathLoad(name, options) {
  const packageName = JSON.stringify(name);
  const attachedName = JSON.stringify(`package:${name}`);
  const source = `base::local({
    lib <- base::dirname(base::find.package(${packageName}))
    before <- lib %in% base::.libPaths()
    base::.libPaths(base::character())
    after <- lib %in% base::.libPaths()
    attachedBefore <- ${attachedName} %in% base::search()
    base::library(${packageName}, lib.loc = lib, character.only = TRUE)
    state <- base::c(before, after, attachedBefore, ${attachedName} %in% base::search(),
      ${packageName} %in% base::loadedNamespaces())
    base::cat("\\nNATIVR_LIBRARY_PATH:", base::paste(base::as.integer(state), collapse = "|"), "\\n", sep = "")
    base::invisible(NULL)
  })`;
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", state: null };
      const marker = /(?:^|\r?\n)NATIVR_LIBRARY_PATH:([01](?:\|[01]){4})\r?\n$/u.exec(
        result.stdout,
      );
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
    policy: "explicit-lib-loc-load-v1",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    actual,
    expected,
    outcome:
      actual.status !== "completed" || expected.status !== "completed"
        ? "incomplete"
        : actual.state === "1|0|0|1|1" && actual.state === expected.state
          ? "match"
          : "mismatch",
    limitations: [
      "Only the package's own library is removed; the system library stays on the path in both runtimes.",
    ],
  };
}
