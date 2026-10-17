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

/** A source-package test entrypoint, supplied verbatim to a caller-owned R evaluator. */
export interface PackageTestScript {
  readonly path: string;
  readonly source: string;
  /** Exact saved R output paired with this entrypoint when the source package provides it. */
  readonly expectedOutput?: { readonly path: string; readonly source: string };
}

/** Explicit interpretation of the saved output supplied by a source package. */
export interface PackageSavedOutputComparisonOptions {
  /** Pins prompt parsing and text normalization semantics for reproducible evidence. */
  readonly policyVersion: 1;
  /** Source-matched `> ` and `+ ` echo lines and one final prompt are removed only in Rout mode. */
  readonly expectedFormat: "rout-save-source-echo" | "display-only";
  /** Exact decoded display text or a diagnostic that ignores display whitespace. */
  readonly comparison: "exact-text" | "display-whitespace";
}

export interface PackageSavedOutputComparison {
  /** Versioned report shape and comparison-policy interpretation. */
  readonly schemaVersion: 1;
  readonly policyVersion: PackageSavedOutputComparisonOptions["policyVersion"];
  readonly path: string;
  readonly expectedPath: string | null;
  readonly expectedFormat: PackageSavedOutputComparisonOptions["expectedFormat"];
  readonly comparison: PackageSavedOutputComparisonOptions["comparison"];
  readonly outcome: "match" | "mismatch" | "no-expectation";
  readonly sourceEchoLinesRemoved: number;
  /** First UTF-16 text difference after the selected format and comparison policy. */
  readonly firstDifference: {
    readonly offset: number;
    readonly line: number;
    readonly column: number;
    readonly expected: string | null;
    readonly actual: string | null;
    readonly expectedExcerpt: string;
    readonly actualExcerpt: string;
  } | null;
}

export interface PackageTestRunOptions {
  readonly limits?: Partial<PackagePackLimits>;
  /** Required when a pinned corpus archive is evaluated. Directories have no archive digest. */
  readonly expectedSourceSha256?: string;
  readonly expectedPackage?: { readonly name: string; readonly version: string };
  /** Exact top-level tests/*.R paths; omission runs every discovered entrypoint. */
  readonly paths?: readonly string[];
}

export interface PackageTestRunResult {
  readonly package: { readonly name: string; readonly version: string };
  readonly sourceSha256: string | null;
  readonly entrypoints: readonly string[];
  readonly nestedRFiles: readonly string[];
  readonly outputExpectations: readonly string[];
  readonly executed: readonly { readonly path: string; readonly status: "completed" | "failed" }[];
  /** Partial selection and absent entrypoints never establish P6 evidence. */
  readonly outcome: "completed" | "partial" | "failed" | "no-tests" | "no-entrypoint";
  readonly firstBlocker: {
    readonly code: "test-error" | "no-entrypoint";
    readonly path?: string;
    readonly message: string;
  } | null;
}

/** A package-check execution captured in a newly created evaluator/process. */
export interface PackageCheckObservation {
  readonly status: "completed" | "failed" | "timed-out" | "cancelled";
  readonly freshSession: boolean;
  /** False when a failed evaluator or bounded capture could not return every output byte. */
  readonly outputComplete: boolean;
  /** False when classes, calls, or warning/error ordering were unavailable to the collector. */
  readonly conditionsComplete: boolean;
  /** Exact decoded text; no newline or whitespace normalization is performed. */
  readonly stdout: string;
  readonly stderr: string;
  readonly conditions: readonly {
    readonly kind: "warning" | "error";
    readonly classes: readonly string[];
    readonly message: string;
    readonly call?: string | null;
  }[];
  /** Omit when independent pipes cannot establish ordering between streams. */
  readonly outputOrder?: readonly { readonly stream: "stdout" | "stderr"; readonly text: string }[];
  /**
   * Oracle observations only: false when re-running the same input produced different output, so
   * no single capture is a stable expectation. Omit when repeatability was not checked.
   */
  readonly repeatable?: boolean;
}

export interface PackageCheckComparisonOptions {
  readonly policyVersion: 1;
  /** Only independently verified oracle text-transport conversion is admitted by policy 1. */
  readonly adaptations: readonly PackageCheckTransportAdaptation[];
}

export interface PackageCheckTransportAdaptation {
  readonly id: "oracle-text-crlf-v1";
  /** Exact versioned literal sent by the native-process transport probe. */
  readonly probeLiteralHex: string;
  readonly stdoutHex: string;
  readonly stderrHex: string;
}

export interface PackageCheckAppliedAdaptation extends PackageCheckTransportAdaptation {
  /** Number of CRLF pairs reversed, once, in each oracle stream. */
  readonly transformedPairs: { readonly stdout: number; readonly stderr: number };
}

export interface PackageCheckDifference {
  readonly field: "status" | "stdout" | "stderr" | "conditions" | "outputOrder";
  /** UTF-16 text offset, condition index, or output-event index, according to field. */
  readonly index: number;
  readonly expected: string | null;
  readonly actual: string | null;
}

export interface PackageCheckComparison {
  readonly policyVersion: 1;
  readonly outcome: "match" | "mismatch" | "no-expectation";
  readonly rawDifference: PackageCheckDifference | null;
  /** Difference after only the explicitly verified oracle transport conversion. */
  readonly adaptedDifference: PackageCheckDifference | null;
  readonly adaptations: readonly PackageCheckAppliedAdaptation[];
  readonly crossStreamOrder: "compared" | "unobserved";
  readonly conditionEvidence: "complete" | "incomplete";
  readonly outputEvidence: "complete" | "incomplete";
}

export type PackageCheckStageId =
  | "archive-artifact"
  | "metadata-dependencies"
  | "installation-loading"
  | "namespace-source"
  | "documentation"
  | "installed-documentation"
  | "native-build-portability"
  | "data"
  | "examples"
  | "package-tests"
  | "test-output"
  | "output-order"
  | "conditions"
  | "vignettes"
  | "manual";

export interface PackageCheckStage {
  readonly id: PackageCheckStageId;
  readonly status: "passed" | "failed" | "unexecuted" | "inapplicable";
  /** Describes the actual check or gives the reason it was not performed. */
  readonly reason: string;
  readonly discovered: readonly string[];
  readonly executed: readonly string[];
}

export interface PackageCheckProvenance {
  readonly sourceSha256: string;
  readonly artifactSha256: string;
  readonly oracle: { readonly implementation: "GNU R"; readonly version: string };
  readonly semanticProfile: string;
  readonly capabilitySha256: string;
  /** The complete effective limits used by the observed NativR sessions. */
  readonly runtimeLimits: {
    readonly maxSteps: number;
    readonly maxCallDepth: number;
    readonly maxVectorLength: number;
    readonly maxOutputBytes: number;
    readonly maxPackageResourceBytes: number;
  };
}

export interface PackageCheckEvidence {
  readonly package: { readonly name: string; readonly version: string };
  readonly provenance: PackageCheckProvenance;
  readonly stages: readonly PackageCheckStage[];
  readonly observations: readonly {
    readonly kind: "test" | "example";
    readonly path: string;
    readonly actual: PackageCheckObservation;
    readonly expected?: PackageCheckObservation;
  }[];
  readonly comparison: PackageCheckComparisonOptions;
}

export interface PackageCheckReport {
  readonly schemaVersion: 1;
  readonly package: PackageCheckEvidence["package"];
  readonly provenance: PackageCheckProvenance;
  readonly stages: readonly PackageCheckStage[];
  readonly observations: readonly (PackageCheckEvidence["observations"][number] & {
    readonly comparison: PackageCheckComparison;
  })[];
  /** Evidence aggregation only; callers must obtain every stage from actual checks. */
  readonly p7Eligible: boolean;
  readonly firstBlocker: {
    readonly stage: PackageCheckStageId | "provenance";
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  } | null;
}

/** One default-applicable Rd example topic, prepared for a caller-owned R evaluator. */
export interface PackageExampleScript {
  readonly path: string;
  readonly topic: string;
  readonly source: string;
}

export interface PackageExampleRunOptions {
  readonly limits?: Partial<PackagePackLimits>;
  /** Required when a pinned corpus archive is evaluated. Directories have no archive digest. */
  readonly expectedSourceSha256?: string;
  readonly expectedPackage?: { readonly name: string; readonly version: string };
  /** Exact man/*.Rd paths; omission considers every discovered example topic. */
  readonly paths?: readonly string[];
}

export interface PackageExampleRunResult {
  readonly package: { readonly name: string; readonly version: string };
  readonly sourceSha256: string | null;
  readonly entrypoints: readonly {
    readonly path: string;
    readonly topic: string;
    readonly applicableBlocks: number;
    readonly excludedDontrunBlocks: number;
    readonly excludedDonttestBlocks: number;
  }[];
  readonly executed: readonly {
    readonly path: string;
    readonly topic: string;
    readonly status: "completed" | "failed";
  }[];
  /** A partial selection, absent examples, or no runnable blocks cannot establish P5 evidence. */
  readonly outcome: "completed" | "partial" | "failed" | "no-examples" | "no-applicable";
  readonly firstBlocker: {
    readonly code: "example-error" | "no-examples" | "no-applicable";
    readonly path?: string;
    readonly topic?: string;
    readonly message: string;
  } | null;
}

export interface ResolvePackageOptions {
  /** Package names to retain; defaults to every supplied artifact. */
  readonly roots?: readonly string[];
  /**
   * Browser-runtime namespaces or application adapters that satisfy dependencies without artifacts.
   * The reserved R entry sets the runtime version for Depends: R, not a package named R.
   */
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
  /** Reject a changed PACKAGES index before downloading archives. */
  readonly expectedIndexIntegrity?: string;
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

export interface RepositoryPreflightOptions extends Omit<RepositoryInstallOptions, "pack"> {
  /** Source OS variant for metadata-only OS_type checks. Default: unix. */
  readonly sourcePlatform?: "unix" | "windows";
}

export interface RepositoryPreflightBlocker {
  readonly code:
    | "missing-package"
    | "version-mismatch"
    | "dependency-cycle"
    | "needs-compilation"
    | "linking-to"
    | "os-type"
    | "invalid-repository-digest";
  readonly package: string;
  readonly requiredBy?: string;
  readonly message: string;
}

export interface RepositoryPreflightResult {
  readonly repository: string;
  readonly indexIntegrity: string;
  readonly roots: readonly string[];
  /** Dependency-first metadata selected from one repository index. */
  readonly packages: readonly {
    readonly name: string;
    readonly version: string;
    readonly sourceUrl: string;
    readonly requirements: readonly PackageDependency[];
  }[];
  readonly blockers: readonly RepositoryPreflightBlocker[];
  readonly firstBlocker: RepositoryPreflightBlocker | null;
  /** Preflight never downloads an archive or establishes P0 corpus evidence. */
  readonly sourceArchiveIntegrity: "unverified";
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
