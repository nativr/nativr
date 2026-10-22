import type { PureRPackageBundle } from "../../../packages/protocol/src/index.js";
import type { AssistedRunnerIdentityV1 } from "./schema.js";

export interface OwnedRunnerFixture {
  readonly id: string;
  readonly path: string;
  readonly source: string;
  readonly sha256: string;
  readonly expected:
    | {
        readonly outcome: "completed" | "partial" | "failed" | "aborted" | "no-tests";
        readonly testOutcome?:
          "passed" | "failed" | "error" | "skipped" | "unsupported" | "aborted";
      }
    | { readonly rejection: string };
  readonly controls: { readonly maxEvents: number; readonly maxTextBytes: number };
  readonly limits?: { readonly maxSteps: number };
}
export function readOwnedRunnerBundle(): Promise<{
  readonly bundle: PureRPackageBundle;
  readonly sourceSha256: string;
  readonly bundleSha256: string;
  readonly runner: AssistedRunnerIdentityV1;
  readonly supportManifest: Readonly<Record<string, unknown>>;
}>;
export function readOwnedRunnerSuite(id: "core"): Promise<{
  readonly id: "core";
  readonly manifestSha256: string;
  readonly fixtures: readonly OwnedRunnerFixture[];
}>;
