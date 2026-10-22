import { readFile } from "node:fs/promises";
import path from "node:path";

const sourcePaths = {
  profiles: "compatibility/profiles.json",
  capabilities: "docs/compatibility-manifest.json",
  surface: "compatibility/gnu-r/surface.json",
  foundation: "conformance/cases/foundation.json",
  oracleV2: "conformance/cases/oracle-v2.json",
  domains: "compatibility/semantic-domains.json",
  annotations: "compatibility/callable-domain-annotations.json",
};

/** Read exact source bytes as UTF-8 so the report binds the maintained inputs. */
export async function readCallableDomainSources(root) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sourcePaths).map(async ([key, file]) => [
        key,
        await readFile(path.join(root, file), "utf8"),
      ]),
    ),
  );
}
