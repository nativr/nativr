import type { PackageDependency } from "../../packages/package-tools/src/types.js";

interface Capture {
  readonly status: string;
  readonly stdout: string;
}
export interface DependencyObservation {
  readonly schemaVersion: 1;
  readonly sourceSha256: string;
  readonly policy: "declared-version-availability-v1" | "declared-version-availability-v2";
  readonly actual: {
    readonly status: string;
    readonly versions: Record<string, string | null> | null;
  };
  readonly expected: {
    readonly status: string;
    readonly versions: Record<string, string | null> | null;
  };
  readonly dependencies: readonly (PackageDependency & {
    readonly required: boolean;
    readonly actual: "satisfied" | "unobserved" | "unavailable" | "version-mismatch";
    readonly expected: "satisfied" | "unobserved" | "unavailable" | "version-mismatch";
  })[];
  readonly limitations: readonly string[];
}
export function observePackageDependencies(
  dependencies: readonly PackageDependency[],
  options: {
    actual: (source: string) => Promise<Capture>;
    expected: (source: string) => Promise<Capture>;
    compareVersions: (left: string, right: string) => number;
  },
): Promise<DependencyObservation>;
