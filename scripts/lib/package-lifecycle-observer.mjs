import { createHash } from "node:crypto";

/** Public namespace/search-path observations, separate from full installation checks. */
export async function observePackageLifecycle(name, options) {
  const packageName = JSON.stringify(name);
  const attachedName = JSON.stringify(`package:${name}`);
  const source = `
base::local({
  before <- base::c(${packageName} %in% base::loadedNamespaces(), ${attachedName} %in% base::search())
  base::invisible(base::getNamespaceExports(${packageName}))
  loaded <- base::c(${packageName} %in% base::loadedNamespaces(), ${attachedName} %in% base::search())
  base::library(${packageName}, character.only = TRUE)
  attached <- base::c(${packageName} %in% base::loadedNamespaces(), ${attachedName} %in% base::search())
  base::library(${packageName}, character.only = TRUE)
  count <- base::sum(base::search() == ${attachedName})
  base::detach(${attachedName}, character.only = TRUE)
  detached <- base::c(${packageName} %in% base::loadedNamespaces(), ${attachedName} %in% base::search())
  base::unloadNamespace(${packageName})
  unloaded <- base::c(${packageName} %in% base::loadedNamespaces(), ${attachedName} %in% base::search())
  base::cat("\\nNATIVR_LIFECYCLE:", base::paste(base::c(before,loaded,attached,count,detached,unloaded),collapse="|"), "\\n",sep="")
  base::invisible(NULL)
})
`;
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", state: null };
      const marker =
        /(?:^|\r?\n)NATIVR_LIFECYCLE:([01](?:\|[01]){5}\|\d+(?:\|[01]){4})\r?\n$/u.exec(
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
    schemaVersion: 2,
    policy: "namespace-load-attach-detach-unload-v2",
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    actual,
    expected,
    outcome:
      actual.status !== "completed" || expected.status !== "completed"
        ? "incomplete"
        : actual.state === "0|0|1|0|1|1|1|1|0|0|0" && actual.state === expected.state
          ? "match"
          : "mismatch",
    limitations: ["Clean-base loading and installation validation remain unexecuted."],
  };
}
