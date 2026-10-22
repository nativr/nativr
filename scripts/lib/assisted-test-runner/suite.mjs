import { sha256 } from "./projection.mjs";

export const OWNED_LIMITS = Object.freeze({
  maxSteps: 10_000_000,
  maxCallDepth: 500,
  maxVectorLength: 1_000_000,
  maxOutputBytes: 1_048_576,
  maxPackageResourceBytes: 1_048_576,
});

/** Host-owned identities for one explicitly selected repository fixture. */
export function fixtureMetadata(fixture, runner, capabilities) {
  return {
    runner: structuredClone(runner),
    input: {
      package: { name: "OwnedRunnerFixture", version: "0.1.0" },
      partition: "owned-fixture",
      sourceSha256: fixture.sha256,
      artifactSha256: sha256(JSON.stringify({ path: fixture.path, source: fixture.source })),
      dependencies: [
        {
          name: "nativrTest",
          version: runner.version,
          implementation: "clean-room-adapter",
          artifactSha256: runner.bundleSha256,
          runnerId: runner.id,
        },
      ],
      files: [{ path: fixture.path, sha256: fixture.sha256, role: "test", selection: "selected" }],
      discoveryPolicy: "explicit-files-v1",
      selectionComplete: true,
    },
    execution: {
      semanticProfile: capabilities.semanticProfileVersion,
      capabilitySha256: sha256(JSON.stringify(capabilities)),
      mode: "inline",
      runtimeProfile: "package-test",
      effectiveLimits: { ...OWNED_LIMITS, ...fixture.limits },
      reporterLimits: { maxEvents: fixture.controls.maxEvents, maxRecordBytes: 65_536 },
      // prepareCapturedRun binds the wrapper, controls, limits, bundle and execution mode.
      configurationSha256: sha256("pending-owned-host-admission"),
    },
  };
}
