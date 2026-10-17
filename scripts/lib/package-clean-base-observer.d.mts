export interface CleanBaseObservation {
  readonly schemaVersion: 1;
  readonly policy: "base-search-path-load-attach-v1";
  readonly sourceSha256: string;
  readonly actual: { readonly status: string; readonly state: string | null };
  readonly expected: { readonly status: string; readonly state: string | null };
  readonly outcome: "incomplete" | "match" | "mismatch";
  readonly limitations: readonly string[];
}
export function observeCleanBaseLoad(
  name: string,
  options: {
    actual: (source: string) => Promise<{ status: string; stdout: string }>;
    expected: (source: string) => Promise<{ status: string; stdout: string }>;
  },
): Promise<CleanBaseObservation>;
