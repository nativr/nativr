export interface AuthorsObservation {
  readonly schemaVersion: 1;
  readonly policy: "authors-person-roles-v1" | "authors-person-roles-v2";
  readonly sourceSha256: string;
  readonly actual: { readonly status: string; readonly state: string | null };
  readonly expected: { readonly status: string; readonly state: string | null };
  readonly outcome: "incomplete" | "match" | "mismatch";
  readonly valid: boolean;
  readonly limitations: readonly string[];
}
export function observePackageAuthors(
  expression: string | undefined,
  options: {
    actual: (source: string) => Promise<{ status: string; stdout: string }>;
    expected: (source: string) => Promise<{ status: string; stdout: string }>;
  },
): Promise<AuthorsObservation | null>;
