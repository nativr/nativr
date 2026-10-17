import { createHash } from "node:crypto";

/** Fresh-session load/attach with only base and Autoloads on the search path. */
export async function observeCleanBaseLoad(name, options) {
  const packageName = JSON.stringify(name);
  const attachedName = JSON.stringify(`package:${name}`);
  const source = `base::local({
    for (pkg in base::c("stats","graphics","grDevices","utils","datasets","methods")) {
      entry <- base::paste0("package:",pkg)
      if (entry %in% base::search()) base::detach(entry,character.only=TRUE)
    }
    before <- base::c(base::identical(base::search(),base::c(".GlobalEnv","Autoloads","package:base")),
      !base::exists("median",base::globalenv()),${packageName} %in% base::loadedNamespaces())
    base::invisible(base::getNamespaceExports(${packageName}))
    loaded <- base::c(${packageName} %in% base::loadedNamespaces(),${attachedName} %in% base::search())
    base::library(${packageName},character.only=TRUE)
    attached <- base::c(${packageName} %in% base::loadedNamespaces(),${attachedName} %in% base::search())
    base::cat("\\nNATIVR_CLEAN_BASE:",base::paste(base::as.integer(base::c(before,loaded,attached)),collapse="|"),"\\n",sep="")
    base::invisible(NULL)
  })`;
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", state: null };
      const marker = /(?:^|\r?\n)NATIVR_CLEAN_BASE:([01](?:\|[01]){6})\r?\n$/u.exec(result.stdout);
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
    policy: "base-search-path-load-attach-v1",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    actual,
    expected,
    outcome:
      actual.status !== "completed" || expected.status !== "completed"
        ? "incomplete"
        : actual.state === "1|1|0|1|0|1|1" && actual.state === expected.state
          ? "match"
          : "mismatch",
    limitations: [
      "Core namespaces remain loaded; this observes a clean search path, not startup with default packages disabled. Full installation validation remains unexecuted.",
    ],
  };
}
