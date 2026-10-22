/** Admitted assisted-report subset. The runtime validator rejects unknown fields. */
export type Sha256 = string; // Exactly 64 lowercase hexadecimal characters.
export type SafePath = string; // Relative POSIX input path: no empty, dot, parent or NUL components.
export type Token = string; // Bounded identifier, never source, output or a condition call.

export interface AssistedRunnerIdentityV1 {
  readonly id: "nativr-cleanroom-test-runner";
  readonly version: "0.1.0";
  readonly sourceSha256: Sha256;
  readonly bundleSha256: Sha256;
  readonly behaviorContractSha256: Sha256;
  readonly apiTarget: {
    readonly package: "testthat";
    readonly documentationVersion: "3.3.2";
    readonly edition: 3;
    // A documentation target is not a claim to implement all its APIs.
    readonly supportedApiManifestSha256: Sha256;
  };
}

export interface AssistedRunReportV1 {
  readonly kind: "nativr-runner-assisted-report";
  readonly schemaVersion: 1;
  readonly normativeTierCredit: false;
  readonly originalDependencyClosureSatisfied: false;
  readonly runner: AssistedRunnerIdentityV1;
  readonly input: {
    readonly package: { readonly name: Token; readonly version: string };
    readonly partition: "owned-fixture" | "development" | "regression";
    readonly sourceSha256: Sha256;
    readonly artifactSha256: Sha256;
    readonly dependencies: readonly {
      readonly name: "nativrTest";
      readonly version: "0.1.0";
      readonly implementation: "clean-room-adapter";
      readonly artifactSha256: Sha256;
      readonly runnerId: "nativr-cleanroom-test-runner";
    }[];
    readonly files: readonly {
      readonly path: SafePath;
      readonly sha256: Sha256;
      readonly role: "test" | "helper" | "setup" | "cleanup" | "fixture";
      readonly selection: "selected" | "unselected";
    }[];
    readonly discoveryPolicy: "explicit-files-v1";
    readonly selectionComplete: boolean;
  };
  readonly execution: {
    readonly semanticProfile: string;
    readonly capabilitySha256: Sha256;
    readonly mode: "inline" | "worker";
    readonly runtimeProfile: "package-test";
    readonly effectiveLimits: {
      readonly maxSteps: number;
      readonly maxCallDepth: number;
      readonly maxVectorLength: number;
      readonly maxOutputBytes: number;
      readonly maxPackageResourceBytes: number;
    };
    readonly reporterLimits: { readonly maxEvents: number; readonly maxRecordBytes: number };
    // Hash of wrapper, capture controls, limits, runner bundle, runtime profile and mode.
    readonly configurationSha256: Sha256;
    readonly capture: {
      readonly eventsComplete: boolean;
      readonly outputComplete: true;
      readonly conditionsComplete: true;
    };
    readonly outcome: "completed" | "partial" | "failed" | "aborted" | "no-tests";
  };
  // Strict, bounded event union. Counts and first blocker are derived, not caller assertions.
  readonly events: readonly AssistedEventV1[];
}

export type AssistedTestOutcomeV1 =
  "passed" | "failed" | "error" | "skipped" | "unsupported" | "aborted";

export type AssistedEventV1 = { readonly sequence: number } & (
  | { readonly type: "run-start" | "run-end" }
  | { readonly type: "file-start" | "file-end"; readonly path: SafePath }
  | {
      readonly type: "test-start";
      readonly path: SafePath;
      readonly testId: number;
      readonly descriptionSha256: Sha256;
    }
  | { readonly type: "test-end"; readonly testId: number; readonly outcome: AssistedTestOutcomeV1 }
  | { readonly type: "skip"; readonly testId: number; readonly messageSha256: Sha256 }
  | {
      readonly type: "expectation";
      readonly testId: number;
      readonly api: "expectation";
      readonly outcome: "passed" | "failed";
      readonly diagnosticSha256: Sha256;
    }
  | {
      readonly type: "condition";
      readonly testId: number;
      readonly conditionKind: "warning" | "message" | "error";
      readonly classNames: readonly Token[];
      readonly messageSha256: Sha256;
      readonly handled: true;
    }
  | {
      readonly type: "lifecycle";
      readonly path: SafePath;
      readonly testId: null;
      readonly phase: "setup" | "cleanup";
      readonly outcome: "started" | "completed" | "failed";
      readonly diagnosticSha256: null;
    }
  | {
      readonly type: "issue";
      readonly path: SafePath | null;
      readonly testId: number | null;
      readonly code:
        | "unsupported-api"
        | "setup-failed"
        | "cleanup-failed"
        | "unexpected-error"
        | "no-expectations";
      readonly api: Token | null;
      readonly diagnosticSha256: Sha256;
    }
);
