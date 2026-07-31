export type PackageDependencyKind = "Depends" | "Imports" | "Suggests" | "Enhances" | "LinkingTo";

export interface PackageDependency {
  readonly name: string;
  readonly kind: PackageDependencyKind;
  readonly constraint?: {
    readonly operator: ">=" | "<=" | "==" | ">" | "<" | "!=";
    readonly version: string;
  };
}

export interface PackagedPureRBundle {
  readonly description: string;
  readonly namespace: string;
  readonly rSources: readonly {
    readonly path: string;
    readonly source: string;
  }[];
  readonly resources: readonly {
    readonly path: string;
    readonly data: string;
  }[];
}

export interface PackageCompatibilityIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path?: string;
}

export interface NativRPackageArtifact {
  readonly format: "nativr-pure-r-package";
  readonly formatVersion: 1;
  /** Source-package OS variant selected deterministically for browser installation. */
  readonly sourcePlatform: "unix" | "windows";
  readonly package: {
    readonly name: string;
    readonly version: string;
    readonly license?: string;
  };
  readonly dependencies: readonly PackageDependency[];
  readonly bundle: PackagedPureRBundle;
  readonly compatibility: {
    /** Whether the source-package install surface can be represented without running host code. */
    readonly packaging: "ready" | "blocked";
    /** Source semantics still need runtime loading and package-specific executable tests. */
    readonly execution: "unchecked";
    readonly issues: readonly PackageCompatibilityIssue[];
  };
  readonly integrity: {
    readonly algorithm: "sha256";
    readonly value: string;
  };
}

export interface PackagePackLimits {
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
  readonly maxPathDepth: number;
}

export interface PackagePackOptions {
  readonly limits?: Partial<PackagePackLimits>;
  /** Selects R/<platform> sources and Collate.<platform>. Default: unix. */
  readonly sourcePlatform?: "unix" | "windows";
}

export interface ResolvePackageOptions {
  /** Package names to retain; defaults to every supplied artifact. */
  readonly roots?: readonly string[];
  /** Browser-runtime namespaces or application adapters that satisfy dependencies without artifacts. */
  readonly providedPackages?: Readonly<Record<string, string>>;
  /** Resolve Suggests as required edges. Default: false. */
  readonly includeSuggests?: boolean;
}

export interface ResolvedPackageSet {
  /** Dependency-first artifacts suitable for caching or deployment. */
  readonly artifacts: readonly NativRPackageArtifact[];
  /** Direct input for `createR({ packages: resolved.bundles })`. */
  readonly bundles: readonly PackagedPureRBundle[];
  readonly lock: {
    readonly format: "nativr-package-lock";
    readonly formatVersion: 1;
    readonly roots: readonly string[];
    readonly packages: readonly {
      readonly name: string;
      readonly version: string;
      readonly integrity: string;
      readonly dependencies: readonly string[];
    }[];
    readonly providedPackages: Readonly<Record<string, string>>;
  };
}

export interface RepositoryInstallOptions extends ResolvePackageOptions {
  /** CRAN-like repository root. Default: https://cran.r-project.org/ */
  readonly repository?: string | URL;
  readonly maxPackages?: number;
  readonly maxDownloadBytes?: number;
  /** Injectable fetch implementation for authenticated mirrors and deterministic tests. */
  readonly fetch?: typeof globalThis.fetch;
  readonly pack?: PackagePackOptions;
}

export interface RepositoryInstallResult extends ResolvedPackageSet {
  readonly repository: string;
  readonly indexIntegrity: string;
}

export class PackageCompatibilityError extends Error {
  public readonly artifact: NativRPackageArtifact;

  public constructor(artifact: NativRPackageArtifact) {
    super(
      `Package '${artifact.package.name}' cannot be packaged for NativR: ${artifact.compatibility.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join("; ")}`,
    );
    this.name = "PackageCompatibilityError";
    this.artifact = artifact;
  }
}
