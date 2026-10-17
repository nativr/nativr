import { createHash } from "node:crypto";
import { parseDcf } from "./dcf.js";
import { extractPackageExamples } from "./rd-examples.js";
import type { PackageSourceFile } from "./source.js";
import type { PackageDependencySource } from "./source-dependency-check.js";
import type { PackagedPureRBundle } from "./types.js";

export interface PackageSourceDependencyInputs {
  readonly sources: readonly PackageDependencySource[];
  readonly failures: readonly {
    readonly path: string;
    readonly role: "test" | "example";
    /** SHA-256 of original bytes; decoded sources have separate UTF-8 text hashes. */
    readonly sha256: string;
    readonly status: "unexecuted";
    readonly reason: "source-decode-failed";
  }[];
}

/** Collect admitted R text without making unreadable, unselected tests abort a report. */
export function collectPackageSourceDependencyInputs(
  bundle: Pick<PackagedPureRBundle, "description" | "rSources">,
  files: readonly PackageSourceFile[],
): PackageSourceDependencyInputs {
  const encoding = parseDcf(bundle.description).get("Encoding");
  const latin1 = /^latin-?1$/iu.test(encoding?.trim() ?? "");
  const sources: PackageDependencySource[] = bundle.rSources.map((file) => ({
    ...file,
    role: "package",
  }));
  const failures: PackageSourceDependencyInputs["failures"][number][] = [];
  for (const file of files) {
    const role = /^tests\/.*\.[Rr]$/u.test(file.path)
      ? "test"
      : /^man\/.*\.Rd$/iu.test(file.path)
        ? "example"
        : undefined;
    if (role === undefined) continue;
    let source: string;
    try {
      source = latin1
        ? Buffer.from(file.data).toString("latin1")
        : new TextDecoder("utf-8", { fatal: true }).decode(file.data);
    } catch {
      failures.push({
        path: file.path,
        role,
        sha256: createHash("sha256").update(file.data).digest("hex"),
        status: "unexecuted",
        reason: "source-decode-failed",
      });
      continue;
    }
    if (role === "test") {
      sources.push({ path: file.path, source, role });
      continue;
    }
    const examples = extractPackageExamples([{ path: file.path, source }]);
    for (const [topicIndex, topic] of (examples?.topics ?? []).entries()) {
      for (const [blockIndex, block] of topic.blocks.entries()) {
        sources.push({
          path: `${file.path}#examples:${topicIndex + 1}:${blockIndex + 1}:${block.kind}`,
          source: block.source,
          role,
        });
      }
    }
  }
  return { sources, failures };
}
