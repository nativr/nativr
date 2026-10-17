export interface AuthorFieldsObservation {
  readonly schemaVersion: 1;
  readonly policy: "authors-derived-fields-v1";
  readonly sourceSha256: string;
  readonly oracleSourceSha256: string;
  readonly actual: {
    readonly status: string;
    readonly fields: { readonly author: string; readonly maintainer: string } | null;
  };
  readonly expected: {
    readonly status: string;
    readonly fields: { readonly author: string; readonly maintainer: string } | null;
  };
  readonly outcome: "incomplete" | "match" | "mismatch";
  readonly limitations: readonly string[];
}
export function observePackageAuthorFields(
  expression: string | undefined,
  fields: { readonly author?: string; readonly maintainer?: string; readonly encoding?: string },
  options: {
    actual: (source: string) => Promise<{ status: string; stdout: string }>;
    expected: (source: string) => Promise<{ status: string; stdout: string }>;
  },
): Promise<AuthorFieldsObservation | null>;
