import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";

const root = new URL("../../../testing/nativr-test-runner/", import.meta.url);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fixtureIds = [
  "pass",
  "fail",
  "unsupported-caught",
  "cleanup-failure",
  "ordinary-error",
  "skip",
  "event-limit",
  "outer-output",
  "runtime-limit",
];
const fail = (message) => {
  throw new Error(message);
};
const exact = (value, keys, message) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== [...keys].sort().join(",")
  )
    fail(message);
};
const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
async function ownedFile(path, maximum = 262144) {
  const url = new URL(path, root);
  const stat = await lstat(url);
  if (!stat.isFile() || stat.size > maximum)
    fail("Owned runner input is not a bounded regular file.");
  const bytes = await readFile(url);
  if (bytes.byteLength > maximum || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf))
    fail("Owned runner input has invalid size or encoding.");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { source, sha256: digest(bytes) };
}

/** Read only the maintained own-name bundle; no arbitrary input root or package is accepted. */
export async function readOwnedRunnerBundle() {
  const [description, namespace, source, contract, support] = await Promise.all([
    ownedFile("DESCRIPTION"),
    ownedFile("NAMESPACE"),
    ownedFile("R/runner.R"),
    ownedFile("behavior-contract.md"),
    ownedFile("support-manifest.json"),
  ]);
  if (
    !/^Package: nativrTest$/m.test(description.source) ||
    !/^Version: 0\.1\.0$/m.test(description.source)
  )
    fail("Unexpected owned runner package identity.");
  const supportManifest = JSON.parse(support.source);
  if (
    supportManifest.kind !== "nativr-owned-runner-support" ||
    supportManifest.schemaVersion !== 1 ||
    supportManifest.runner !== "nativr-cleanroom-test-runner" ||
    supportManifest.version !== "0.1.0" ||
    supportManifest.normativeTierCredit !== false ||
    supportManifest.originalDependencyClosureSatisfied !== false ||
    supportManifest.hasCompleteNativeParity !== false ||
    !Array.isArray(supportManifest.apis)
  )
    fail("Invalid owned runner support manifest.");
  const bundle = {
    description: description.source,
    namespace: namespace.source,
    rSources: [{ path: "R/runner.R", source: source.source }],
  };
  const bundleSha256 = digest(JSON.stringify(bundle));
  const runner = {
    id: "nativr-cleanroom-test-runner",
    version: "0.1.0",
    sourceSha256: source.sha256,
    bundleSha256,
    behaviorContractSha256: contract.sha256,
    apiTarget: {
      package: "testthat",
      documentationVersion: "3.3.2",
      edition: 3,
      supportedApiManifestSha256: support.sha256,
    },
  };
  return freeze({ bundle, sourceSha256: source.sha256, bundleSha256, runner, supportManifest });
}

/** Fixed owned suite only: validate every path and source pin before returning executable text. */
export async function readOwnedRunnerSuite(id) {
  if (id !== "core") fail("Only the owned core suite is supported.");
  const input = await ownedFile("fixtures/manifest.json");
  const manifest = JSON.parse(input.source);
  exact(
    manifest,
    [
      "kind",
      "schemaVersion",
      "id",
      "runnerVersion",
      "normativeTierCredit",
      "originalDependencyClosureSatisfied",
      "fixtures",
    ],
    "Invalid owned suite manifest fields.",
  );
  if (
    manifest.kind !== "nativr-owned-assisted-suite" ||
    manifest.schemaVersion !== 1 ||
    manifest.id !== "core" ||
    manifest.runnerVersion !== "0.1.0" ||
    manifest.normativeTierCredit !== false ||
    manifest.originalDependencyClosureSatisfied !== false ||
    !Array.isArray(manifest.fixtures) ||
    manifest.fixtures.length !== fixtureIds.length
  )
    fail("Invalid owned suite identity.");
  const fixtures = [];
  let totalBytes = 0;
  for (let index = 0; index < fixtureIds.length; index++) {
    const row = manifest.fixtures[index];
    exact(
      row,
      [
        "id",
        "path",
        "sha256",
        "expected",
        "controls",
        ...(row?.limits === undefined ? [] : ["limits"]),
      ],
      "Invalid owned fixture fields.",
    );
    if (
      row.id !== fixtureIds[index] ||
      row.path !== `tests/test-${fixtureIds[index]}.R` ||
      !/^[0-9a-f]{64}$/.test(row.sha256)
    )
      fail("Invalid owned fixture identity or path.");
    exact(row.controls, ["maxEvents", "maxTextBytes"], "Invalid owned fixture controls.");
    if (
      !Number.isSafeInteger(row.controls.maxEvents) ||
      row.controls.maxEvents < 2 ||
      row.controls.maxEvents > 10000 ||
      !Number.isSafeInteger(row.controls.maxTextBytes) ||
      row.controls.maxTextBytes < 1 ||
      row.controls.maxTextBytes > 65536
    )
      fail("Invalid owned fixture control limits.");
    if (row.expected?.rejection !== undefined) {
      exact(row.expected, ["rejection"], "Invalid expected rejection fields.");
      if (
        !["unaccounted-host-effects", "evaluation-or-capture-failed"].includes(
          row.expected.rejection,
        )
      )
        fail("Unknown owned fixture rejection.");
    } else {
      exact(
        row.expected,
        ["outcome", ...(row.expected?.testOutcome === undefined ? [] : ["testOutcome"])],
        "Invalid expected outcome fields.",
      );
      if (
        !["completed", "partial", "failed", "aborted", "no-tests"].includes(row.expected.outcome) ||
        (row.expected.testOutcome !== undefined &&
          !["passed", "failed", "error", "skipped", "unsupported", "aborted"].includes(
            row.expected.testOutcome,
          ))
      )
        fail("Unknown owned fixture outcome.");
    }
    if (row.limits !== undefined) {
      exact(row.limits, ["maxSteps"], "Invalid owned fixture runtime limits.");
      if (
        !Number.isSafeInteger(row.limits.maxSteps) ||
        row.limits.maxSteps < 1 ||
        row.limits.maxSteps > 10000000
      )
        fail("Invalid owned fixture step limit.");
    }
    const file = await ownedFile(`fixtures/${row.path}`);
    totalBytes += Buffer.byteLength(file.source, "utf8");
    if (totalBytes > 262144 || file.sha256 !== row.sha256)
      fail("Owned fixture source pin or aggregate size mismatch.");
    fixtures.push({ ...row, source: file.source });
  }
  return freeze({ id: "core", manifestSha256: input.sha256, fixtures });
}
