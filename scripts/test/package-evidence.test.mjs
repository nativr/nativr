import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { check } from "prettier";
import formatting from "../../prettier.config.mjs";
import {
  EvidenceFault,
  PACKAGE_NAMES,
  SETTINGS,
  STAGES,
  assertStable,
  evidenceIndex,
  packageCheckArguments,
  parseEvidenceArguments,
  safeFailure,
  selectPackages,
  sha256,
  validateBaseline,
  validateManifest,
  validatePackageReport,
  validateSnapshot,
  verifyArchive,
} from "../lib/package-evidence.mjs";
import { assertDirectoryBoundary, runEvidence } from "../package-evidence.mjs";

const profile = "0.900.0";
const baselineProfile = "0.899.0";
const hash = "a".repeat(64);
const head = "b".repeat(40);
const marker = "OWNED_PRIVATE_SOURCE_SENTINEL C:\\private\\body function(x) { x }";
const host = { platform: "win32", arch: "x64", nodeVersion: "v24.7.0" };
const timestamp = "2026-10-22T12:00:00.000Z";
const manifest = {
  targetRVersion: "4.6.1",
  languageSubsetVersion: profile,
  semanticProfileVersion: profile,
};
const identity = validateManifest(manifest);
const packages = PACKAGE_NAMES.map((name, index) => ({
  name,
  version: ["1.4-8", "2016.8-1.1"][index],
  partition: index === 0 ? "regression" : "development",
  sourceSha256: sha256(`owned opaque archive ${name}`),
  artifactSha256: String(index + 1).repeat(64),
}));
const inventory = [
  { kind: "test", path: "tests/owned.R", inputSha256: hash },
  { kind: "example", path: "examples/owned.R", inputSha256: "c".repeat(64) },
];
const expectedFor = (entry = packages[0]) => ({ ...identity, entry, observations: inventory });
const encoded = (value) => Buffer.from(JSON.stringify(value));
const snapshot = [{ path: "packages/nativr/dist/index.js", bytes: 42, sha256: hash }];
const indexArgs = () => ({
  expected: { ...identity, packages, baselineProfile },
  before: snapshot,
  after: structuredClone(snapshot),
  host,
  head,
  recordedAt: timestamp,
  results: packages.map((entry, index) => ({
    name: entry.name,
    validated: true,
    p7Eligible: index === 0,
    summarySha256: hash,
  })),
});

function reportFixture(entry = packages[0], p7Eligible = true) {
  return {
    schemaVersion: 1,
    package: { name: entry.name, version: entry.version, license: "Apache-2.0" },
    provenance: {
      ...identity,
      sourceSha256: entry.sourceSha256,
      artifactSha256: entry.artifactSha256,
      oracle: { implementation: "GNU R", version: "4.6.1" },
      runtimeLimits: Object.fromEntries(
        [
          "maxSteps",
          "maxCallDepth",
          "maxVectorLength",
          "maxOutputBytes",
          "maxPackageResourceBytes",
        ].map((name) => [name, SETTINGS[name]]),
      ),
    },
    executionProfile: {
      execution: "inline",
      runtimeProfile: "package-test",
      capture: "native-rscript-top-level-v1",
      outputOrderCapture: "merged-handle-unique-alignment-v1",
      oracleRepeat: true,
      rng: {
        policy: "explicit-seed-v1",
        seed: SETTINGS.rngSeed,
        kinds: ["Mersenne-Twister", "Inversion", "Rejection"],
      },
      oracle: {
        version: "4.6.1",
        packageVersion: { abind: "1.4.8", numDeriv: "2016.8.1.1" }[entry.name],
        installationExitCode: 0,
        installationSignal: null,
      },
    },
    p7Eligible,
    firstBlocker: p7Eligible
      ? null
      : { stage: "package-tests", code: "NRE_OWNED_FIXTURE", message: marker },
    stages: STAGES.map((id) => ({
      id,
      status: !p7Eligible && id === "package-tests" ? "failed" : "passed",
      reason: marker,
      discovered: [marker],
      executed: [marker],
    })),
    execution: inventory.map(({ kind, path, inputSha256 }) => ({
      kind,
      path,
      sourceSha256: inputSha256,
      source: marker,
    })),
    observations: inventory.map(({ kind, path }) => ({
      kind,
      path,
      actual: {
        status: "completed",
        stdout: marker,
        conditions: [marker],
        freshSession: true,
        outputComplete: true,
        conditionsComplete: true,
        outputOrder: [],
      },
      expected: {
        status: "completed",
        repeatable: true,
        stdout: marker,
        freshSession: true,
        outputComplete: true,
        conditionsComplete: true,
        outputOrder: [],
      },
      comparison: {
        outcome: "match",
        rawDifference: marker,
        crossStreamOrder: "compared",
        outputEvidence: "complete",
        conditionEvidence: "complete",
      },
    })),
    inventory: {
      paths: ["DESCRIPTION", "NAMESPACE", "R/owned.R", "man/owned.Rd", "tests/owned.R"],
      nestedRFiles: [],
    },
    runners: { tests: { outcome: "completed" }, examples: { outcome: "completed" } },
  };
}

function baselineFixture(entry) {
  const summary = validatePackageReport(encoded(reportFixture(entry)), expectedFor(entry), 0);
  summary.provenance.semanticProfile = baselineProfile;
  return summary;
}

const assertCode = (operation, code) =>
  assert.throws(operation, (error) => error instanceof EvidenceFault && error.code === code);

test("CLI defaults to preflight and requires explicit cached input, oracle, baseline, and output", () => {
  const parsed = parseEvidenceArguments([
    "--archive-dir",
    "cache",
    "--output",
    ".tmp/owned",
    "--rscript",
    "tools/Rscript",
    "--baseline-profile",
    baselineProfile,
  ]);
  assert.equal(parsed.run, false);
  assert.deepEqual(
    parseEvidenceArguments([
      "--",
      "--archive-dir",
      "cache",
      "--output",
      ".tmp/owned",
      "--rscript",
      "tools/Rscript",
      "--baseline-profile",
      baselineProfile,
    ]),
    parsed,
  );
  assert.deepEqual(parsed.packages, PACKAGE_NAMES);
  assert.equal(
    parseEvidenceArguments([
      "--run",
      "--archive-dir",
      "cache",
      "--output",
      ".tmp/owned",
      "--rscript",
      "tools/Rscript",
      "--baseline-profile",
      baselineProfile,
    ]).run,
    true,
  );
  for (const args of [[], ["--download"], ["--run", "--run"], ["--output"]])
    assert.throws(() => parseEvidenceArguments(args), EvidenceFault);
});

test("CLI fixed pair rejects holdout, extra packages, repeats, and source-like arguments", () => {
  for (const selection of [
    "abind,Formula",
    "abind,numDeriv,Formula",
    "abind,abind",
    "../abind,numDeriv",
  ])
    assertCode(
      () =>
        parseEvidenceArguments([
          "--archive-dir",
          "cache",
          "--output",
          "out",
          "--rscript",
          "R",
          "--baseline-profile",
          baselineProfile,
          "--packages",
          selection,
        ]),
      "EVIDENCE_PACKAGE_SELECTION",
    );
});

test("corpus admits only the two pinned development/regression entries", () => {
  const corpus = {
    schemaVersion: 2,
    targetR: "4.6.1",
    packages: packages.map(({ name, ...p }) => ({ ...p, package: name })),
  };
  assert.deepEqual(selectPackages(corpus), packages);
  corpus.packages[0].partition = "holdout";
  assertCode(() => selectPackages(corpus), "EVIDENCE_HOLDOUT");
  corpus.packages[0].partition = "regression";
  corpus.packages[0].artifactSha256 = "unknown";
  assertCode(() => selectPackages(corpus), "EVIDENCE_PACKAGE_PINS");
});

test("archive pin verification treats archive bytes as opaque", () => {
  verifyArchive(Buffer.from("owned opaque archive abind"), packages[0]);
  assertCode(() => verifyArchive(Buffer.from("changed"), packages[0]), "EVIDENCE_ARCHIVE_PIN");
});

test("manifest identities must agree and capability digest covers all fields", () => {
  assertCode(
    () => validateManifest({ ...manifest, languageSubsetVersion: "0.1.0" }),
    "EVIDENCE_MANIFEST",
  );
  assertCode(() => validateManifest({ ...manifest, targetRVersion: "4.5.0" }), "EVIDENCE_MANIFEST");
  assert.notEqual(
    validateManifest({ ...manifest, aNewCapability: true }).capabilitySha256,
    identity.capabilitySha256,
  );
});

test("baseline inventory checks package/pins/profile and unique relative input hashes", () => {
  const summary = baselineFixture(packages[0]);
  assert.equal(validateBaseline(summary, packages[0], baselineProfile).length, 2);
  assertCode(() => validateBaseline(summary, packages[0], profile), "EVIDENCE_BASELINE");
  summary.observations.push(summary.observations[0]);
  assertCode(
    () => validateBaseline(summary, packages[0], baselineProfile),
    "EVIDENCE_DUPLICATE_OBSERVATION",
  );
});

test("complete non-P7 report with child exit 1 is valid evidence", () => {
  const summary = validatePackageReport(
    encoded(reportFixture(packages[0], false)),
    expectedFor(),
    1,
  );
  assert.equal(summary.p7Eligible, false);
  assert.equal(summary.firstBlocker.code, "NRE_OWNED_FIXTURE");
  assert.equal(summary.stages.find((s) => s.id === "package-tests").status, "failed");
  assert.equal(summary.comparisons.total, 2);
});

test("valid redaction removes bodies, diagnostics, absolute paths, and arbitrary fields", () => {
  const raw = encoded(reportFixture(packages[0], false));
  const summary = validatePackageReport(raw, expectedFor(), 1);
  const text = JSON.stringify(summary);
  assert.equal(text.includes(marker), false);
  assert.equal(text.includes("private"), false);
  assert.equal(text.includes("rawForeignBody"), false);
  assert.equal(summary.rawReportSha256, sha256(raw));
  assert.deepEqual(summary.redaction, {
    policy: "allowlisted-metadata-sha256-v2",
    rawOutputIncluded: false,
    rawConditionsIncluded: false,
    sourceIncluded: false,
  });
});

for (const [label, mutation, code] of [
  [
    "wrong source pin",
    (r) => {
      r.provenance.sourceSha256 = hash;
    },
    "EVIDENCE_REPORT_PINS",
  ],
  [
    "wrong artifact pin",
    (r) => {
      r.provenance.artifactSha256 = hash;
    },
    "EVIDENCE_REPORT_PINS",
  ],
  [
    "stale semantic profile",
    (r) => {
      r.provenance.semanticProfile = baselineProfile;
    },
    "EVIDENCE_REPORT_STALE",
  ],
  [
    "stale capabilities",
    (r) => {
      r.provenance.capabilitySha256 = hash;
    },
    "EVIDENCE_REPORT_STALE",
  ],
  [
    "wrong oracle",
    (r) => {
      r.provenance.oracle.version = "4.5.0";
    },
    "EVIDENCE_ORACLE_VERSION",
  ],
  [
    "wrong installed package",
    (r) => {
      r.executionProfile.oracle.packageVersion = "9.9.9";
    },
    "EVIDENCE_ORACLE_IDENTITY",
  ],
  [
    "failed installation",
    (r) => {
      r.executionProfile.oracle.installationExitCode = 1;
    },
    "EVIDENCE_ORACLE_IDENTITY",
  ],
  [
    "wrong runtime budget",
    (r) => {
      r.provenance.runtimeLimits.maxSteps++;
    },
    "EVIDENCE_REPORT_SETTINGS",
  ],
  [
    "repeatability disabled",
    (r) => {
      r.executionProfile.oracleRepeat = false;
    },
    "EVIDENCE_REPORT_SETTINGS",
  ],
  [
    "uncontrolled RNG",
    (r) => {
      r.executionProfile.rng.seed++;
    },
    "EVIDENCE_REPORT_SETTINGS",
  ],
  [
    "missing stage",
    (r) => {
      r.stages.pop();
    },
    "EVIDENCE_STAGE_INVENTORY",
  ],
  [
    "duplicate stage",
    (r) => {
      r.stages[1] = r.stages[0];
    },
    "EVIDENCE_STAGE_INVENTORY",
  ],
  [
    "missing observation",
    (r) => {
      r.observations.pop();
    },
    "EVIDENCE_OBSERVATION_INCOMPLETE",
  ],
  [
    "missing execution",
    (r) => {
      r.execution.pop();
      r.observations.pop();
    },
    "EVIDENCE_OBSERVATION_INCOMPLETE",
  ],
  [
    "changed input",
    (r) => {
      r.execution[0].sourceSha256 = "d".repeat(64);
    },
    "EVIDENCE_OBSERVATION_INCOMPLETE",
  ],
  [
    "duplicate observation",
    (r) => {
      r.observations.push(r.observations[0]);
    },
    "EVIDENCE_DUPLICATE_OBSERVATION",
  ],
  [
    "absolute package path",
    (r) => {
      r.execution[0].path = "C:/private/owned.R";
    },
    "EVIDENCE_OBSERVATION_INVENTORY",
  ],
  [
    "missing repeatability observation",
    (r) => {
      delete r.observations[0].expected.repeatable;
    },
    "EVIDENCE_CAPTURE",
  ],
  [
    "missing runner",
    (r) => {
      r.runners.examples = null;
    },
    "EVIDENCE_RUNNER",
  ],
  [
    "P7 with failed stage",
    (r) => {
      r.stages[0].status = "failed";
    },
    "EVIDENCE_P7_INCONSISTENT",
  ],
])
  test(`rejects ${label}`, () => {
    const raw = reportFixture();
    mutation(raw);
    assertCode(() => validatePackageReport(encoded(raw), expectedFor(), 0), code);
  });

test("malformed, truncated, empty, and invalid report schemas fail closed", () => {
  assertCode(
    () => validatePackageReport(Buffer.alloc(0), expectedFor(), 0),
    "EVIDENCE_REPORT_SIZE",
  );
  assertCode(
    () => validatePackageReport(Buffer.from("{"), expectedFor(), 0),
    "EVIDENCE_REPORT_JSON",
  );
  assertCode(
    () => validatePackageReport(encoded({ schemaVersion: 99 }), expectedFor(), 0),
    "EVIDENCE_REPORT_SCHEMA",
  );
});

test("child crashes or P7/exit contradictions cannot become valid captures", () => {
  for (const exit of [1, 2, null])
    assertCode(
      () => validatePackageReport(encoded(reportFixture()), expectedFor(), exit),
      "EVIDENCE_CHILD_EXIT",
    );
  assertCode(
    () => validatePackageReport(encoded(reportFixture(packages[0], false)), expectedFor(), 0),
    "EVIDENCE_CHILD_EXIT",
  );
});

test("P7 cannot hide failed captures, mismatches, or unrepeatable oracle observations", () => {
  for (const change of [
    (report) => {
      report.observations[0].actual.status = "failed";
    },
    (report) => {
      report.observations[0].expected.status = "failed";
    },
    (report) => {
      report.observations[0].comparison.outcome = "mismatch";
    },
    (report) => {
      report.observations[0].expected.repeatable = false;
    },
    (report) => {
      report.observations[0].actual.freshSession = false;
    },
    (report) => {
      report.observations[0].expected.freshSession = false;
    },
    (report) => {
      report.observations[0].actual.outputComplete = false;
    },
    (report) => {
      report.observations[0].expected.conditionsComplete = false;
    },
    (report) => {
      report.observations[0].comparison.crossStreamOrder = "unobserved";
    },
    (report) => {
      report.observations[0].comparison.outputEvidence = "incomplete";
    },
    (report) => {
      report.observations[0].comparison.conditionEvidence = "incomplete";
    },
    (report) => {
      delete report.observations[0].actual.outputOrder;
    },
  ]) {
    const report = reportFixture();
    change(report);
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_P7_INCONSISTENT",
    );
  }
});

test("P7 cannot hide empty, incomplete, extra, or invalidly inapplicable stage inventories", () => {
  for (const change of [
    (stage) => {
      stage.discovered = [];
      stage.executed = [];
    },
    (stage) => {
      stage.executed = [];
    },
    (stage) => {
      stage.executed.push("owned unexpected input");
    },
    (stage) => {
      stage.status = "inapplicable";
      stage.discovered = [];
      stage.executed = [];
    },
  ]) {
    const report = reportFixture();
    change(report.stages[0]);
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_P7_INCONSISTENT",
    );
  }
});

test("current reports cannot hide unverified nested closure behind a passed stage", () => {
  for (const status of ["passed", "inapplicable"]) {
    const report = reportFixture(packages[0], false);
    report.firstBlocker.stage = "documentation";
    report.stages.find((stage) => stage.id === "documentation").status = "failed";
    const stage = report.stages.find((stage) => stage.id === "package-tests");
    stage.status = status;
    report.inventory.nestedRFiles = ["tests/helpers/owned.R"];
    report.inventory.paths.push("tests/helpers/owned.R");
    stage.discovered.push("tests/helpers/owned.R");
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 1),
      "EVIDENCE_NESTED_TEST_COVERAGE",
    );
  }
  const report = reportFixture();
  report.inventory.nestedRFiles = ["tests/helpers/owned.R"];
  report.inventory.paths.push("tests/helpers/owned.R");
  assertCode(
    () => validatePackageReport(encoded(report), expectedFor(), 0),
    "EVIDENCE_NESTED_TEST_COVERAGE",
  );
});

test("current nested reports retain failed or unexecuted stages without invented execution", () => {
  for (const status of ["failed", "unexecuted"]) {
    const report = reportFixture(packages[0], false);
    report.inventory.nestedRFiles = ["tests/helpers/owned.R"];
    report.inventory.paths.push("tests/helpers/owned.R");
    const stage = report.stages.find((stage) => stage.id === "package-tests");
    stage.status = status;
    stage.discovered.push("tests/helpers/owned.R");
    assert.equal(validatePackageReport(encoded(report), expectedFor(), 1).p7Eligible, false);
    for (const fault of ["absent", "executed", "duplicate", "invalid"]) {
      const mutated = structuredClone(report);
      const target = mutated.stages.find((candidate) => candidate.id === "package-tests");
      if (fault === "absent") target.discovered = [marker];
      if (fault === "executed") target.executed.push("tests/helpers/owned.R");
      if (fault === "duplicate") mutated.inventory.nestedRFiles.push("tests/helpers/owned.R");
      if (fault === "invalid") mutated.inventory.nestedRFiles = ["tests/../outside.R"];
      assertCode(
        () => validatePackageReport(encoded(mutated), expectedFor(), 1),
        "EVIDENCE_NESTED_TEST_COVERAGE",
      );
    }
  }
});

test("current raw inventory cannot omit or invent nested R paths", () => {
  for (const fault of ["omitted-declaration", "invented-declaration", "duplicate-path"]) {
    const report = reportFixture();
    if (fault !== "invented-declaration") report.inventory.paths.push("tests/helpers/owned.R");
    if (fault !== "omitted-declaration")
      report.inventory.nestedRFiles.push("tests/helpers/owned.R");
    if (fault === "duplicate-path") report.inventory.paths.push("tests/helpers/owned.R");
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_NESTED_TEST_COVERAGE",
    );
  }
  const report = reportFixture(packages[0], false);
  report.inventory.paths.push("tests/helpers/a.R", "tests/helpers/a.R");
  report.inventory.nestedRFiles = ["tests/helpers/a.R", "tests/helpers/b.R"];
  const stage = report.stages.find((candidate) => candidate.id === "package-tests");
  stage.status = "unexecuted";
  stage.discovered.push(...report.inventory.nestedRFiles);
  assertCode(
    () => validatePackageReport(encoded(report), expectedFor(), 1),
    "EVIDENCE_NESTED_TEST_COVERAGE",
  );
  for (const paths of [undefined, null, [null], [42]]) {
    const report = reportFixture();
    report.inventory.paths = paths;
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_REPORT_INVENTORY",
    );
  }
});

test("assisted identity is rejected before the original-report redactor can drop it", () => {
  for (const key of [
    "kind",
    "runner",
    "substitutions",
    "assisted",
    "runnerAssisted",
    "normativeTierCredit",
    "originalDependencyClosureSatisfied",
  ]) {
    const report = reportFixture();
    report[key] = key === "kind" ? "nativr-runner-assisted-report" : false;
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_ASSISTED_REPORT",
    );
  }
  const report = reportFixture();
  report.executionProfile.runner = { version: "1.0.0" };
  assertCode(
    () => validatePackageReport(encoded(report), expectedFor(), 0),
    "EVIDENCE_ASSISTED_REPORT",
  );
});

test("stable snapshot is order independent and rejects added/deleted/changed artifacts", () => {
  const rows = [...snapshot, { path: "scripts/tool.mjs", bytes: 12, sha256: "c".repeat(64) }];
  assertStable(rows, [...rows].reverse());
  assertCode(() => assertStable(rows, rows.slice(1)), "EVIDENCE_ARTIFACT_CHANGED");
  assertCode(
    () => assertStable(rows, [...rows, { path: "scripts/added.mjs", bytes: 0, sha256: hash }]),
    "EVIDENCE_ARTIFACT_CHANGED",
  );
  assertCode(
    () =>
      assertStable(
        rows,
        rows.map((r) => ({ ...r, sha256: hash })),
      ),
    "EVIDENCE_ARTIFACT_CHANGED",
  );
  assertCode(() => validateSnapshot([{ ...snapshot[0], path: "../outside" }]), "EVIDENCE_SNAPSHOT");
});

test("mixed or unknown raw identity envelopes cannot be redacted into original evidence", () => {
  for (const change of [
    (report) => {
      report.dependencies = { runner: "nativrTest" };
    },
    (report) => {
      report.provenance.runner = "nativrTest";
    },
    (report) => {
      report.provenance.oracle.substitutions = [];
    },
    (report) => {
      report.executionProfile.oracle.runner = "nativrTest";
    },
    (report) => {
      report.rawForeignBody = marker;
    },
  ]) {
    const report = reportFixture();
    change(report);
    assertCode(
      () => validatePackageReport(encoded(report), expectedFor(), 0),
      "EVIDENCE_REPORT_SCHEMA",
    );
  }
});

test("index success means complete evidence, and retains blocked package result without tier promotion", () => {
  const report = evidenceIndex(indexArgs());
  assert.equal(report.ok, true);
  assert.equal(report.packages[1].p7Eligible, false);
  assert.equal(report.normativeTierCredit, false);
  assert.equal(report.oracle.classification, "advisory-local-not-rfc-0007-gate");
  assert.equal(JSON.stringify(report).includes('"tier"'), false);
});

test("index rejects incomplete pair, missing digests, and concurrent artifact mutation", () => {
  for (const mutation of [
    (a) => {
      a.results.pop();
    },
    (a) => {
      delete a.results[0].summarySha256;
    },
    (a) => {
      a.after = [{ ...snapshot[0], bytes: 43 }];
    },
  ]) {
    const args = indexArgs();
    mutation(args);
    assert.equal(evidenceIndex(args).ok, false);
  }
  const args = indexArgs();
  args.expected.semanticProfile = marker;
  assertCode(() => evidenceIndex(args), "EVIDENCE_INDEX_EXPECTATION");
});

test("failure serialization permits controlled codes only", () => {
  assert.deepEqual(safeFailure(marker, new Error(marker)), {
    stage: "unclassified",
    code: "EVIDENCE_OPERATION_FAILED",
    redacted: true,
  });
  assert.equal(safeFailure("package", new EvidenceFault(marker)).code, "EVIDENCE_OPERATION_FAILED");
  assert.equal(
    safeFailure("package", new EvidenceFault("EVIDENCE_CHILD_TIMEOUT")).code,
    "EVIDENCE_CHILD_TIMEOUT",
  );
});

test("package CLI always supplies pinned archive, full execution, repeatability and bounded settings", () => {
  const args = packageCheckArguments(
    "/owned",
    packages[0],
    "/cached/pin.tar.gz",
    "/raw/report.json",
    "/tools/Rscript",
  );
  assert.equal(args[args.indexOf("--source") + 1], "/cached/pin.tar.gz");
  assert.ok(args.includes("--oracle-repeat"));
  assert.ok(!args.includes("--skip-examples") && !args.includes("--test"));
  assert.equal(args[args.indexOf("--max-steps") + 1], "300000000");
});

async function fixture(t, mode = {}) {
  const temporaryRoot = path.join(os.tmpdir(), "nativr-package-evidence-tests");
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, "owned-"));
  t.after(async () => {
    const relative = path.relative(await realpath(temporaryRoot), await realpath(root));
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const put = async (relative, data) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  };
  const corpus = {
    schemaVersion: 2,
    targetR: "4.6.1",
    packages: packages.map(({ name, ...p }) => ({ ...p, package: name })),
  };
  if (mode.holdout) corpus.packages[0].partition = "holdout";
  await put("compatibility/package-corpus.json", encoded(corpus));
  await put("docs/compatibility-manifest.json", encoded(manifest));
  for (const file of [
    "package.json",
    "pnpm-lock.yaml",
    "prettier.config.mjs",
    "scripts/package-evidence.mjs",
    "scripts/package-check.mjs",
    "scripts/capability-manifest.mjs",
    "scripts/lib/owned.mjs",
    "tools/node",
    "tools/Rscript",
  ])
    await put(file, "owned fixture; never executed");
  for (const name of ["ast", "base", "nativr", "package-tools", "parser", "protocol", "runtime"]) {
    await put(`packages/${name}/package.json`, "{}");
    await put(`packages/${name}/src/index.ts`, "owned fixture source");
    await put(`packages/${name}/dist/index.js`, "owned fixture; must never be imported");
  }
  for (const entry of packages) {
    if (!mode.missingArchive || entry.name !== "abind")
      await put(
        `cache/${entry.name}_${entry.version}.tar.gz`,
        `owned opaque archive ${entry.name}`,
      );
    await put(
      `compatibility/package-check-evidence/${baselineProfile}/${entry.name}.json`,
      encoded(baselineFixture(entry)),
    );
  }
  const calls = [];
  const processRunner = async (call) => {
    calls.push(call);
    const response = {
      exitCode: 0,
      signal: null,
      stdout: Buffer.alloc(0),
      output: {
        stdout: { bytes: 0, sha256: sha256("") },
        stderr: { bytes: 0, sha256: sha256("") },
      },
    };
    if (call.file === "git") {
      response.stdout = Buffer.from(call.args[0] === "rev-parse" ? head : "");
      return response;
    }
    if (call.file.endsWith("Rscript")) {
      response.stdout = Buffer.from(mode.wrongR ? "4.5.0" : "4.6.1");
      return response;
    }
    if (call.args[0].endsWith("capability-manifest.mjs")) {
      response.exitCode = mode.staleDist ? 1 : 0;
      return response;
    }
    assert.ok(call.args[0].endsWith("package-check.mjs"));
    const name = call.args[call.args.indexOf("--package") + 1];
    const output = call.args[call.args.indexOf("--output") + 1];
    const entry = packages.find((candidate) => candidate.name === name);
    const report = reportFixture(entry, name === "abind");
    response.exitCode = name === "abind" ? 0 : 1;
    if (mode.missingReport === name) return response;
    if (mode.partial === name) report.observations.pop();
    if (mode.assisted === name) report.kind = "nativr-runner-assisted-report";
    if (mode.crash === name) throw new Error(marker);
    await writeFile(output, encoded(report));
    if (mode.mutate && name === "numDeriv")
      await put("packages/nativr/dist/index.js", "changed during execution");
    if (mode.mutateSource && name === "numDeriv")
      await put("packages/runtime/src/index.ts", "changed source during execution");
    return response;
  };
  const options = {
    run: true,
    packages: [...PACKAGE_NAMES],
    "archive-dir": "cache",
    output: "evidence",
    rscript: "tools/Rscript",
    "baseline-profile": baselineProfile,
  };
  return {
    root,
    options,
    calls,
    dependencies: {
      root,
      processRunner,
      nodePath: path.join(root, "tools/node"),
      host,
      now: () => timestamp,
    },
  };
}

test("preflight uses only filesystem and Git stubs; no runtime or oracle launch", async (t) => {
  const f = await fixture(t);
  f.options.run = false;
  const report = await runEvidence(f.options, f.dependencies);
  assert.equal(report.ok, true);
  assert.equal(report.execution, "not-requested");
  assert.equal(report.oracleVersionVerified, false);
  assert.equal(report.runtimeCapabilitiesVerified, false);
  assert.ok(f.calls.every((call) => call.file === "git"));
  assert.deepEqual(await readdir(path.join(f.root, "evidence")), ["preflight.json"]);
});

test("stub full run publishes complete redacted pair and keeps raw reports outside output", async (t) => {
  const f = await fixture(t);
  const report = await runEvidence(f.options, f.dependencies);
  assert.equal(report.ok, true);
  assert.equal(report.stableArtifacts, true);
  assert.deepEqual(
    report.packages.map((p) => p.p7Eligible),
    [true, false],
  );
  assert.deepEqual((await readdir(path.join(f.root, "evidence"))).sort(), [
    "abind.json",
    "index.json",
    "numDeriv.json",
  ]);
  for (const file of ["abind.json", "index.json", "numDeriv.json"]) {
    const text = await readFile(path.join(f.root, "evidence", file), "utf8");
    assert.equal(text.includes(marker), false);
    assert.equal(text.includes(f.root), false);
    assert.equal(await check(text, { ...formatting, parser: "json" }), true);
    if (file !== "index.json")
      assert.equal(
        report.packages.find((entry) => entry.summary === file).summarySha256,
        sha256(text),
      );
  }
  const calls = f.calls.filter((call) => call.args[0]?.endsWith("package-check.mjs"));
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (call) =>
        call.args.includes("--source") &&
        call.captureLimit === 0 &&
        call.timeoutMs === SETTINGS.packageTimeoutMs,
    ),
  );
  const raw = calls[0].args[calls[0].args.indexOf("--output") + 1];
  assert.ok(raw.startsWith(path.join(f.root, ".tmp/package-evidence-raw/")));
  assert.ok((await readFile(raw, "utf8")).includes("OWNED_PRIVATE_SOURCE_SENTINEL"));
});

for (const [name, mode, expectedCode] of [
  ["holdout", { holdout: true }, "EVIDENCE_HOLDOUT"],
  ["missing archive", { missingArchive: true }, "EVIDENCE_OPERATION_FAILED"],
  ["stale dist", { staleDist: true }, "EVIDENCE_CAPABILITIES"],
  ["wrong R", { wrongR: true }, "EVIDENCE_ORACLE_VERSION"],
  ["partial report", { partial: "numDeriv" }, "EVIDENCE_OBSERVATION_INCOMPLETE"],
  ["assisted report", { assisted: "abind" }, "EVIDENCE_ASSISTED_REPORT"],
  ["missing report", { missingReport: "abind" }, "EVIDENCE_OPERATION_FAILED"],
  ["child crash", { crash: "abind" }, "EVIDENCE_OPERATION_FAILED"],
  ["concurrent dist mutation", { mutate: true }, "EVIDENCE_ARTIFACT_CHANGED"],
  ["concurrent source mutation", { mutateSource: true }, "EVIDENCE_ARTIFACT_CHANGED"],
])
  test(`stub run retains redacted failure for ${name}`, async (t) => {
    const f = await fixture(t, mode);
    const report = await runEvidence(f.options, f.dependencies);
    assert.equal(report.ok, false);
    assert.ok(report.failures.some((failure) => failure.code === expectedCode));
    assert.equal(JSON.stringify(report).includes(marker), false);
    assert.equal(JSON.stringify(report).includes(f.root), false);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(f.root, "evidence/index.json"), "utf8")),
      report,
    );
  });

test("output reuse cannot admit stale summaries or overwrite prior evidence", async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, "evidence"));
  await writeFile(path.join(f.root, "evidence/index.json"), "owned existing evidence");
  const report = await runEvidence(f.options, f.dependencies);
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].code, "EVIDENCE_OUTPUT_EXISTS");
  assert.equal(
    await readFile(path.join(f.root, "evidence/index.json"), "utf8"),
    "owned existing evidence",
  );
  assert.equal(f.calls.length, 0);
});

test("raw quarantine and publishable output cannot overlap", async (t) => {
  const f = await fixture(t);
  f.options.output = ".tmp/package-evidence-raw/published";
  const report = await runEvidence(f.options, f.dependencies);
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].code, "EVIDENCE_OUTPUT_PATH");
  assert.equal(f.calls.length, 0);
});

test("in-repository junction aliases cannot put raw quarantine inside publishable output", async () => {
  const root = path.resolve("owned-repository");
  const target = path.join(root, "alias/package-evidence-raw");
  const alias = path.join(root, "alias");
  await assert.rejects(
    assertDirectoryBoundary(root, target, {
      inspect: async (file) => {
        if (file === target) throw Object.assign(new Error("owned missing"), { code: "ENOENT" });
        return { isSymbolicLink: () => file === alias };
      },
      resolve: async () => path.join(root, ".tmp"),
    }),
    (error) => error.code === "EVIDENCE_OUTPUT_PATH",
  );
});

test("an existing raw-root junction cannot redirect raw reports into the output directory", async () => {
  const root = path.resolve("owned-repository");
  const target = path.join(root, ".tmp/package-evidence-raw");
  await assert.rejects(
    assertDirectoryBoundary(root, target, {
      inspect: async (file) => ({ isSymbolicLink: () => file === target }),
      resolve: async () => path.join(root, "evidence"),
      code: "EVIDENCE_QUARANTINE_PATH",
    }),
    (error) => error.code === "EVIDENCE_QUARANTINE_PATH",
  );
});

test("Windows directory boundary accepts equivalent root case and stops before its parent", async () => {
  const inspected = [];
  await assertDirectoryBoundary("C:\\Owned\\Repository", "c:\\owned\\repository\\Output\\new", {
    pathApi: path.win32,
    inspect: async (file) => {
      inspected.push(file);
      return { isSymbolicLink: () => false };
    },
    resolve: async (file) => file,
  });
  assert.deepEqual(inspected, [
    "c:\\owned\\repository\\Output\\new",
    "c:\\owned\\repository\\Output",
  ]);
});
