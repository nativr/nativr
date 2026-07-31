import type {
  NativRPackageArtifact,
  PackageDependency,
  ResolvePackageOptions,
  ResolvedPackageSet,
} from "./types.js";

const DEFAULT_PROVIDED_PACKAGES: Readonly<Record<string, string>> = Object.freeze({
  R: "4.6.0",
  base: "4.6.0",
  stats: "4.6.0",
  graphics: "4.6.0",
  grDevices: "4.6.0",
  methods: "4.6.0",
  utils: "4.6.0",
});

export function resolvePackageArtifacts(
  artifacts: readonly NativRPackageArtifact[],
  options: ResolvePackageOptions = {},
): ResolvedPackageSet {
  const byName = new Map<string, NativRPackageArtifact>();
  for (const artifact of artifacts) {
    if (artifact.compatibility.packaging !== "ready") {
      throw new Error(`Package '${artifact.package.name}' has a blocked install surface.`);
    }
    const previous = byName.get(artifact.package.name);
    if (previous !== undefined) {
      throw new Error(
        `Package '${artifact.package.name}' was supplied at both ${previous.package.version} and ${artifact.package.version}.`,
      );
    }
    byName.set(artifact.package.name, artifact);
  }
  const roots = Object.freeze([...(options.roots ?? [...byName.keys()].sort())]);
  const providedPackages: Readonly<Record<string, string>> = Object.freeze({
    ...DEFAULT_PROVIDED_PACKAGES,
    ...options.providedPackages,
  });
  const ordered: NativRPackageArtifact[] = [];
  const complete = new Set<string>();
  const visiting: string[] = [];
  for (const root of roots) visit(root, undefined);

  const packages = ordered.map((artifact) => ({
    name: artifact.package.name,
    version: artifact.package.version,
    integrity: `sha256-${artifact.integrity.value}`,
    dependencies: Object.freeze(
      requiredDependencies(artifact, options.includeSuggests === true)
        .filter((dependency) => byName.has(dependency.name))
        .map((dependency) => dependency.name)
        .sort(),
    ),
  }));
  return Object.freeze({
    artifacts: Object.freeze(ordered),
    bundles: Object.freeze(ordered.map((artifact) => artifact.bundle)),
    lock: Object.freeze({
      format: "nativr-package-lock" as const,
      formatVersion: 1 as const,
      roots,
      packages: Object.freeze(packages),
      providedPackages,
    }),
  });

  function visit(name: string, requiredBy: string | undefined): void {
    if (complete.has(name)) return;
    const artifact = byName.get(name);
    if (artifact === undefined) {
      const providedVersion = providedPackages[name];
      if (providedVersion !== undefined) return;
      throw new Error(
        requiredBy === undefined
          ? `Root package '${name}' was not supplied.`
          : `Package '${requiredBy}' requires missing package '${name}'.`,
      );
    }
    const cycleIndex = visiting.indexOf(name);
    if (cycleIndex >= 0) {
      throw new Error(
        `Package dependency cycle: ${[...visiting.slice(cycleIndex), name].join(" -> ")}.`,
      );
    }
    visiting.push(name);
    for (const dependency of requiredDependencies(artifact, options.includeSuggests === true)) {
      const dependencyArtifact = byName.get(dependency.name);
      const availableVersion =
        dependencyArtifact?.package.version ?? providedPackages[dependency.name];
      if (availableVersion === undefined) {
        throw new Error(`Package '${name}' requires missing package '${dependency.name}'.`);
      }
      if (!satisfiesDependency(availableVersion, dependency)) {
        const constraint = dependency.constraint;
        throw new Error(
          `Package '${name}' requires '${dependency.name}' ${constraint?.operator ?? ""} ${constraint?.version ?? ""}, but ${availableVersion} is available.`.replaceAll(
            /\s+/gu,
            " ",
          ),
        );
      }
      if (dependencyArtifact !== undefined) visit(dependency.name, name);
    }
    visiting.pop();
    complete.add(name);
    ordered.push(artifact);
  }
}

export function comparePackageVersions(left: string, right: string): number {
  const leftParts = packageVersionParts(left);
  const rightParts = packageVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0n;
    const rightPart = rightParts[index] ?? 0n;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

function packageVersionParts(value: string): readonly bigint[] {
  if (!/^[0-9]+(?:[.-][0-9]+)*$/u.test(value))
    throw new Error(`Invalid package version '${value}'.`);
  return value.split(/[.-]/u).map((part) => BigInt(part));
}

function requiredDependencies(
  artifact: NativRPackageArtifact,
  includeSuggests: boolean,
): readonly PackageDependency[] {
  return artifact.dependencies.filter(
    (dependency) =>
      dependency.kind === "Depends" ||
      dependency.kind === "Imports" ||
      (includeSuggests && dependency.kind === "Suggests"),
  );
}

function satisfiesDependency(version: string, dependency: PackageDependency): boolean {
  const constraint = dependency.constraint;
  if (constraint === undefined) return true;
  const comparison = comparePackageVersions(version, constraint.version);
  switch (constraint.operator) {
    case ">=":
      return comparison >= 0;
    case "<=":
      return comparison <= 0;
    case "==":
      return comparison === 0;
    case ">":
      return comparison > 0;
    case "<":
      return comparison < 0;
    case "!=":
      return comparison !== 0;
  }
}
