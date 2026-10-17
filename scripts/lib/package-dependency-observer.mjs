import { createHash } from "node:crypto";

/** Observe declared versions through public APIs in caller-supplied isolated sessions. */
export async function observePackageDependencies(dependencies, options) {
  const lookupKey = (dependency) =>
    dependency.name === "R" && dependency.kind !== "Depends" ? "package:R" : dependency.name;
  const names = [...new Set(dependencies.map(lookupKey))];
  const source =
    names
      .map((name, index) => {
        const lookup =
          name === "R"
            ? "getRversion()"
            : `utils::packageVersion(${JSON.stringify(name === "package:R" ? "R" : name)})`;
        return `local({ v <- tryCatch(as.character(${lookup}), error = function(e) "unavailable"); cat(${JSON.stringify(`${index}\t`)}, v, "\\n", sep = "") })`;
      })
      .join("\n") + "\ninvisible(NULL)\n";
  const capture = async (run) => {
    try {
      const result = await run(source);
      if (result.status !== "completed") return { status: "failed", versions: null };
      const lines = result.stdout.replaceAll("\r\n", "\n").split("\n");
      if (lines.pop() !== "" || lines.length !== names.length)
        return { status: "invalid-output", versions: null };
      const versions = {};
      for (const [index, name] of names.entries()) {
        const prefix = `${index}\t`;
        if (!lines[index].startsWith(prefix)) return { status: "invalid-output", versions: null };
        const version = lines[index].slice(prefix.length);
        if (version !== "unavailable" && !/^\d+(?:[.-]\d+)*$/u.test(version))
          return { status: "invalid-output", versions: null };
        Object.defineProperty(versions, name, {
          value: version === "unavailable" ? null : version,
          enumerable: true,
        });
      }
      return { status: "completed", versions };
    } catch {
      return { status: "failed", versions: null };
    }
  };
  const actual = await capture(options.actual);
  const expected = await capture(options.expected);
  const assess = (observation, dependency) => {
    if (observation.versions === null) return "unobserved";
    const version = observation.versions[lookupKey(dependency)];
    if (version === null) return "unavailable";
    if (dependency.constraint === undefined) return "satisfied";
    const comparison = options.compareVersions(version, dependency.constraint.version);
    const accepted = {
      ">=": comparison >= 0,
      "<=": comparison <= 0,
      "==": comparison === 0,
      ">": comparison > 0,
      "<": comparison < 0,
      "!=": comparison !== 0,
    }[dependency.constraint.operator];
    if (accepted === undefined) throw new Error("Unsupported dependency constraint operator.");
    return accepted ? "satisfied" : "version-mismatch";
  };
  return {
    schemaVersion: 1,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    policy: "declared-version-availability-v2",
    actual,
    expected,
    dependencies: dependencies.map((dependency) => ({
      ...dependency,
      // Enhances is observed but not required by this check profile.
      required: dependency.kind !== "Enhances",
      actual: assess(actual, dependency),
      expected: assess(expected, dependency),
    })),
    limitations: [
      "Version lookup does not establish namespace loading, API compatibility, or transitive dependency closure.",
      "Unavailable means the public version lookup failed; it does not distinguish missing packages from unsupported lookup behavior.",
      "Broader DESCRIPTION validation and undeclared source dependencies remain unexecuted.",
    ],
  };
}
