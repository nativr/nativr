import type { AuthorFieldsObservation } from "./package-author-fields-observer.mjs";
export const packageEmailPattern: string;
export interface EffectiveAuthorAssessment {
  readonly schemaVersion: 1;
  readonly policy: "effective-author-fields-v1";
  readonly checks: readonly {
    readonly id: string;
    readonly status: "passed" | "failed" | "unexecuted";
    readonly message: string;
  }[];
  readonly limitations: readonly string[];
}
export function assessEffectiveAuthorFields(
  fields: ReadonlyMap<string, string>,
  observation: AuthorFieldsObservation | null | undefined,
): EffectiveAuthorAssessment;
