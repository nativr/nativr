export interface LifecycleObservation {
  readonly schemaVersion: 1 | 2;
  readonly policy: "namespace-load-attach-v1" | "namespace-load-attach-detach-unload-v2";
  readonly sourceSha256: string;
  readonly actual: { readonly status: string; readonly state: string | null };
  readonly expected: { readonly status: string; readonly state: string | null };
  readonly outcome: "incomplete" | "match" | "mismatch";
  readonly limitations: readonly string[];
}
export function observePackageLifecycle(
  name: string,
  options: {
    actual: (source: string) => Promise<{ status: string; stdout: string }>;
    expected: (source: string) => Promise<{ status: string; stdout: string }>;
  },
): Promise<LifecycleObservation>;
