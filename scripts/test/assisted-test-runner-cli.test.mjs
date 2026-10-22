import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { check, format } from "prettier";
import formatting from "../../prettier.config.mjs";
import {
  AssistedSuiteError,
  parseAssistedArguments,
  runAssistedSuite,
  validateSuiteResult,
} from "../assisted-test-runner.mjs";
import { capturedRunMetadata, prepareCapturedRun } from "../lib/assisted-test-runner/capture.mjs";
import { createAdmission, projectEvaluation } from "../lib/assisted-test-runner/projection.mjs";
import { fixtureMetadata } from "../lib/assisted-test-runner/suite.mjs";
import { validatePackageReport } from "../lib/package-evidence.mjs";
import { evaluation, rawReport } from "./fixtures/assisted-test-runner/transport.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);
const privateTag = "OWNED_PRIVATE_CLI_SENTINEL";
const privateMarker = `${privateTag} C:\\private\\source function(x) { x }`;
const capabilities = {
  targetRVersion: "4.6.1",
  semanticProfileVersion: "0.900.0",
  languageSubsetVersion: "0.900.0",
};
const source = `# ${privateMarker}\nowned <- TRUE\n`;
const bundle = {
  description: "Package: nativrTest\nVersion: 0.1.0\nLicense: Apache-2.0\n",
  namespace: "export(owned)\n",
  rSources: [{ path: "R/runner.R", source }],
};
const runnerBundle = {
  bundle,
  runner: {
    id: "nativr-cleanroom-test-runner",
    version: "0.1.0",
    sourceSha256: digest(source),
    bundleSha256: digest(JSON.stringify(bundle)),
    behaviorContractSha256: digest("owned contract"),
    apiTarget: {
      package: "testthat",
      documentationVersion: "3.3.2",
      edition: 3,
      supportedApiManifestSha256: digest("owned supported API manifest"),
    },
  },
};
const expectations = [
  ["pass", { outcome: "completed" }],
  ["fail", { outcome: "failed" }],
  ["unsupported-caught", { outcome: "partial", testOutcome: "unsupported" }],
  ["cleanup-failure", { outcome: "failed" }],
  ["ordinary-error", { outcome: "failed", testOutcome: "error" }],
  ["skip", { outcome: "completed", testOutcome: "skipped" }],
  ["event-limit", { outcome: "aborted" }],
  ["outer-output", { rejection: "unaccounted-host-effects" }],
  ["runtime-limit", { rejection: "evaluation-or-capture-failed" }],
];
const suite = {
  id: "core",
  manifestSha256: digest("owned fixed nine-fixture contract"),
  fixtures: expectations.map(([id, expected]) => {
    const fixtureSource = `# ${privateMarker}\n# fixture ${id}\nTRUE\n`;
    return {
      id,
      path: `tests/test-${id}.R`,
      source: fixtureSource,
      sha256: digest(fixtureSource),
      expected,
      controls: { maxEvents: id === "event-limit" ? 3 : 1000, maxTextBytes: 8192 },
      ...(id === "runtime-limit" ? { limits: { maxSteps: 50000 } } : {}),
    };
  }),
};

// Owned event fixtures model the nine contract outcomes without importing or executing runtime.
function publicReport(fixture) {
  const p = fixture.path;
  let events = [
    { type: "run-start" },
    { type: "file-start", path: p },
    { type: "test-start", path: p, testId: 1, description: privateMarker },
    {
      type: "expectation",
      testId: 1,
      api: "expectation",
      outcome: "passed",
      message: privateMarker,
    },
    { type: "test-end", testId: 1, outcome: "passed" },
    { type: "file-end", path: p },
    { type: "run-end" },
  ];
  if (fixture.id === "fail") {
    events[3].outcome = "failed";
    events[4].outcome = "failed";
  } else if (fixture.id === "unsupported-caught") {
    events.splice(3, 0, {
      type: "issue",
      path: p,
      testId: 1,
      code: "unsupported-api",
      api: "expect_identical: waldo comparison",
      message: privateMarker,
    });
  } else if (fixture.id === "cleanup-failure") {
    events.splice(
      5,
      0,
      { type: "lifecycle", path: p, testId: null, phase: "cleanup", outcome: "started" },
      {
        type: "issue",
        path: p,
        testId: null,
        code: "cleanup-failed",
        api: null,
        message: privateMarker,
      },
      { type: "lifecycle", path: p, testId: null, phase: "cleanup", outcome: "failed" },
    );
  } else if (fixture.id === "ordinary-error") {
    events.splice(
      3,
      1,
      {
        type: "condition",
        testId: 1,
        conditionKind: "error",
        classNames: ["error", "condition"],
        message: privateMarker,
        handled: true,
      },
      {
        type: "issue",
        path: p,
        testId: 1,
        code: "unexpected-error",
        api: null,
        message: privateMarker,
      },
    );
    events[5].outcome = "error";
  } else if (fixture.id === "skip") {
    events.splice(4, 0, { type: "skip", testId: 1, message: privateMarker });
    events[5].outcome = "skipped";
  } else if (fixture.id === "event-limit") events = events.slice(0, 3);
  const plan = prepareCapturedRun(
    fixtureMetadata(fixture, runnerBundle.runner, capabilities),
    [{ path: p, source: fixture.source }],
    bundle,
    fixture.controls,
  );
  const metadata = capturedRunMetadata(plan);
  return projectEvaluation(
    createAdmission(metadata),
    evaluation(rawReport(events, fixture.expected.outcome, fixture.id !== "event-limit")),
  ).report;
}

function childResult() {
  return {
    kind: "nativr-owned-assisted-suite-result",
    schemaVersion: 1,
    results: suite.fixtures.map((fixture) =>
      fixture.expected.rejection
        ? { id: fixture.id, rejectionCode: fixture.expected.rejection }
        : { id: fixture.id, report: publicReport(fixture) },
    ),
  };
}
const processResult = (result = childResult()) => ({
  exitCode: 0,
  signal: null,
  stdout: Buffer.from(JSON.stringify(result)),
  stderr: Buffer.from(privateMarker),
});
const snapshot = [
  { path: "packages/nativr/dist/index.js", bytes: 17, sha256: digest("owned artifact") },
];
const validate = (value) => validateSuiteResult(value, suite, runnerBundle, capabilities);
const rejectsCode = (operation, code) =>
  assert.throws(operation, (error) => error instanceof AssistedSuiteError && error.code === code);

async function fixtureRoot(t) {
  const base = await realpath(os.tmpdir());
  const temporary = await mkdtemp(path.join(base, "nativr-assisted-cli-"));
  const root = path.join(temporary, "repository");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(
    path.join(root, "docs/compatibility-manifest.json"),
    JSON.stringify(capabilities),
  );
  t.after(async () => {
    const canonical = await realpath(temporary);
    const relative = path.relative(base, canonical);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(canonical, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const options = { suite: "core", out: ".tmp/assisted-test-runs/owned" };
  const calls = [];
  const dependencies = {
    root,
    loadBundle: async () => clone(runnerBundle),
    loadSuite: async () => clone(suite),
    snapshot: async () => clone(snapshot),
    processRunner: async (request) => {
      calls.push(request);
      return processResult();
    },
  };
  return { root, temporary, options, dependencies, calls, output: path.join(root, options.out) };
}

test("CLI accepts explicit core suite and output in either order", () => {
  const expected = { suite: "core", out: ".tmp/assisted-test-runs/owned" };
  assert.deepEqual(parseAssistedArguments(["--suite", "core", "--out", expected.out]), expected);
  assert.deepEqual(parseAssistedArguments(["--out", expected.out, "--suite", "core"]), expected);
});

test("CLI accepts the standalone pnpm argument separator", () => {
  assert.deepEqual(
    parseAssistedArguments(["--", "--suite", "core", "--out", ".tmp/assisted-test-runs/owned"]),
    { suite: "core", out: ".tmp/assisted-test-runs/owned" },
  );
});

for (const [name, args] of [
  ["missing all arguments", []],
  ["missing output", ["--suite", "core"]],
  ["missing suite", ["--out", "owned"]],
  ["unknown suite", ["--suite", "testthat", "--out", "owned"]],
  ["missing flag value", ["--suite", "core", "--out"]],
  ["duplicate suite", ["--suite", "core", "--suite", "core", "--out", "owned"]],
  ["duplicate output", ["--suite", "core", "--out", "owned", "--out", "other"]],
  ["unknown argument", ["--suite", "core", "--out", "owned", "--download", "yes"]],
  ["flag as value", ["--suite", "core", "--out", "--run"]],
  ["empty output", ["--suite", "core", "--out", " "]],
  ["NUL output", ["--suite", "core", "--out", "owned\0secret"]],
  ["oversized output", ["--suite", "core", "--out", "x".repeat(501)]],
  ["interior separator", ["--suite", "core", "--", "--out", "owned"]],
  ["multiple separators", ["--", "--", "--suite", "core", "--out", "owned"]],
])
  test(`CLI rejects ${name}`, () =>
    rejectsCode(() => parseAssistedArguments(args), "ASSISTED_ARGUMENT"));

test("nine admitted outcomes stay distinct and never receive original-runner credit", () => {
  const input = childResult();
  const rows = validate(input);
  assert.equal(rows.length, 9);
  assert.deepEqual(
    rows.map((row) => row.report?.execution.outcome ?? row.rejectionCode),
    [
      "completed",
      "failed",
      "partial",
      "failed",
      "failed",
      "completed",
      "aborted",
      "unaccounted-host-effects",
      "evaluation-or-capture-failed",
    ],
  );
  assert.ok(rows.every((row) => row.expectationMatched === true));
  for (const row of rows.filter((item) => item.report)) {
    assert.equal(row.report.normativeTierCredit, false);
    assert.equal(row.report.originalDependencyClosureSatisfied, false);
  }
  assert.equal(JSON.stringify(rows).includes(privateTag), false);
});

test("an admitted assisted report is rejected by the original package evidence boundary", () => {
  const admitted = validate(childResult())[0].report;
  assert.throws(() => validatePackageReport(Buffer.from(JSON.stringify(admitted)), {}, 0), {
    code: "EVIDENCE_ASSISTED_REPORT",
  });
});

test("suite validator rejects missing, duplicate, reordered, and extra rows", () => {
  for (const mutate of [
    (r) => r.results.pop(),
    (r) => {
      r.results[1] = clone(r.results[0]);
    },
    (r) => r.results.reverse(),
    (r) => r.results.push(clone(r.results[0])),
  ]) {
    const result = clone(childResult());
    mutate(result);
    assert.throws(() => validate(result));
  }
});

test("suite validator rejects original reports and raw diagnostic envelopes", () => {
  for (const mutate of [
    (r) => {
      r.kind = "package-check";
    },
    (r) => {
      r.p7Eligible = true;
    },
    (r) => {
      r.results[0].report.kind = "package-check";
    },
    (r) => {
      r.results[0].report.normativeTierCredit = true;
    },
    (r) => {
      r.results[0].raw = privateMarker;
    },
    (r) => {
      r.results[0].report.body = privateMarker;
    },
    (r) => {
      r.results[7].message = privateMarker;
    },
  ]) {
    const result = clone(childResult());
    mutate(result);
    assert.throws(
      () => validate(result),
      (error) => !String(error.message).includes(privateMarker),
    );
  }
});

test("valid but contradictory fixture outcomes and rejection identities are rejected", () => {
  const result = clone(childResult());
  const differentSuite = clone(suite);
  differentSuite.fixtures[0].expected.outcome = "failed";
  rejectsCode(
    () => validateSuiteResult(result, differentSuite, runnerBundle, capabilities),
    "ASSISTED_EXPECTATION",
  );
  differentSuite.fixtures[0].expected.outcome = "completed";
  differentSuite.fixtures[0].expected.testOutcome = "skipped";
  rejectsCode(
    () => validateSuiteResult(result, differentSuite, runnerBundle, capabilities),
    "ASSISTED_EXPECTATION",
  );
  result.results[7].rejectionCode = "evaluation-or-capture-failed";
  rejectsCode(() => validate(result), "ASSISTED_UNEXPECTED_REJECTION");
});

test("valid report metadata must match the pinned host profile, source, bundle and controls", () => {
  for (const mutate of [
    (r) => {
      r.execution.semanticProfile = "0.901.0";
    },
    (r) => {
      r.execution.capabilitySha256 = digest("other capabilities");
    },
    (r) => {
      r.execution.configurationSha256 = digest("other controls");
    },
    (r) => {
      r.runner.sourceSha256 = digest("other runner source");
    },
    (r) => {
      r.runner.behaviorContractSha256 = digest("other runner contract");
    },
    (r) => {
      r.input.sourceSha256 = digest("other fixture source");
    },
    (r) => {
      r.input.artifactSha256 = digest("other fixture artifact");
    },
    (r) => {
      r.input.files[0].sha256 = digest("other selected source");
    },
    (r) => {
      r.execution.effectiveLimits.maxSteps += 1;
    },
  ]) {
    const result = clone(childResult());
    mutate(result.results[0].report);
    rejectsCode(() => validate(result), "ASSISTED_REPORT_IDENTITY");
  }
});

test("successful publication binds hashes to canonical bytes and strips private text", async (t) => {
  const fixture = await fixtureRoot(t);
  const result = await runAssistedSuite(fixture.options, fixture.dependencies);
  assert.equal(result.ok, true);
  assert.equal(result.realTestthatParity, false);
  assert.equal(result.normativeTierCredit, false);
  assert.equal(result.originalDependencyClosureSatisfied, false);
  assert.equal(result.stableArtifacts, true);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].file, process.execPath);
  assert.equal(fixture.calls[0].cwd, fixture.root);
  assert.equal(fixture.calls[0].timeoutMs, 120000);
  assert.equal(fixture.calls[0].captureLimit, 8 * 1024 * 1024);
  assert.deepEqual(fixture.calls[0].args, [
    path.join(fixture.root, "scripts/lib/assisted-test-runner/execute.mjs"),
    "core",
  ]);
  const files = await readdir(fixture.output);
  assert.equal(files.length, 8);
  for (const row of result.results.filter((item) => item.report)) {
    const bytes = await readFile(path.join(fixture.output, row.report));
    assert.equal(row.reportSha256, digest(bytes));
    assert.equal(await check(bytes.toString("utf8"), { ...formatting, parser: "json" }), true);
    assert.equal(
      bytes.toString("utf8"),
      await format(JSON.stringify(JSON.parse(bytes)), { ...formatting, parser: "json" }),
    );
  }
  for (const file of files) {
    const text = await readFile(path.join(fixture.output, file), "utf8");
    assert.equal(text.includes(privateTag), false);
    assert.equal(text.includes(fixture.root), false);
    assert.equal(text.includes(JSON.stringify(fixture.root).slice(1, -1)), false);
    assert.equal(text.includes("p7Eligible"), false);
  }
  const indexBytes = await readFile(path.join(fixture.output, "index.json"), "utf8");
  assert.deepEqual(JSON.parse(indexBytes), result);
  assert.equal(await check(indexBytes, { ...formatting, parser: "json" }), true);
});

for (const out of [
  ".",
  ".tmp/assisted-test-runs",
  ".tmp/other",
  ".tmp/assisted-test-runs/../outside",
  "../outside",
]) {
  test(`output boundary rejects ${out}`, async (t) => {
    const fixture = await fixtureRoot(t);
    await assert.rejects(runAssistedSuite({ ...fixture.options, out }, fixture.dependencies), {
      code: "ASSISTED_OUTPUT_PATH",
    });
    assert.equal(fixture.calls.length, 0);
  });
}

test("an existing output directory cannot be overwritten", async (t) => {
  const fixture = await fixtureRoot(t);
  await mkdir(fixture.output, { recursive: true });
  const sentinel = path.join(fixture.output, "owned.txt");
  await writeFile(sentinel, "preserve");
  await assert.rejects(runAssistedSuite(fixture.options, fixture.dependencies), {
    code: "ASSISTED_OUTPUT_EXISTS",
  });
  assert.equal(await readFile(sentinel, "utf8"), "preserve");
  assert.equal(fixture.calls.length, 0);
});

test("junction or symlink ancestors cannot redirect output outside its allowed tree", async (t) => {
  const fixture = await fixtureRoot(t);
  const allowed = path.dirname(fixture.output);
  const outside = path.join(fixture.temporary, "outside");
  await mkdir(allowed, { recursive: true });
  await mkdir(outside);
  try {
    await symlink(
      outside,
      path.join(allowed, "alias"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip("The host does not permit creation of the owned test link.");
      return;
    }
    throw error;
  }
  await assert.rejects(
    runAssistedSuite(
      { ...fixture.options, out: ".tmp/assisted-test-runs/alias/owned" },
      fixture.dependencies,
    ),
  );
  assert.deepEqual(await readdir(outside), []);
  assert.equal(fixture.calls.length, 0);
});

test("profile disagreement rejects before the child starts", async (t) => {
  const fixture = await fixtureRoot(t);
  await writeFile(
    path.join(fixture.root, "docs/compatibility-manifest.json"),
    JSON.stringify({ ...capabilities, languageSubsetVersion: "0.901.0" }),
  );
  await assert.rejects(runAssistedSuite(fixture.options, fixture.dependencies), {
    code: "ASSISTED_PROFILE",
  });
  assert.equal(fixture.calls.length, 0);
});

for (const [name, child, code] of [
  ["no stdout", { ...processResult(), stdout: Buffer.alloc(0) }, "ASSISTED_CHILD_JSON"],
  [
    "malformed JSON",
    { ...processResult(), stdout: Buffer.from(`{${privateMarker}`) },
    "ASSISTED_CHILD_JSON",
  ],
  ["invalid UTF8", { ...processResult(), stdout: Buffer.from([0xff]) }, "ASSISTED_CHILD_JSON"],
  ["nonzero exit", { ...processResult(), exitCode: 1 }, "ASSISTED_CHILD_FAILED"],
  ["terminated child", { ...processResult(), signal: "SIGTERM" }, "ASSISTED_CHILD_FAILED"],
  ["nonbyte stdout", { ...processResult(), stdout: privateMarker }, "ASSISTED_CHILD_BYTES"],
  [
    "oversized stdout",
    { ...processResult(), stdout: Buffer.alloc(8 * 1024 * 1024 + 1) },
    "ASSISTED_CHILD_BYTES",
  ],
])
  test(`rejects ${name} without publishing raw diagnostics`, async (t) => {
    const fixture = await fixtureRoot(t);
    fixture.dependencies.processRunner = async () => child;
    await assert.rejects(
      runAssistedSuite(fixture.options, fixture.dependencies),
      (error) => error.code === code && !String(error.message).includes(privateMarker),
    );
    assert.deepEqual(await readdir(fixture.output), []);
  });

test("child cannot publish a contradictory outcome or original package report", async (t) => {
  for (const kind of ["outcome", "original"]) {
    const fixture = await fixtureRoot(t);
    const result = clone(childResult());
    if (kind === "outcome") result.results[0].report.execution.outcome = "failed";
    else
      result.results[0].report = { kind: "package-check", p7Eligible: true, source: privateMarker };
    fixture.dependencies.processRunner = async () => processResult(result);
    await assert.rejects(
      runAssistedSuite(fixture.options, fixture.dependencies),
      (error) => !String(error.message).includes(privateMarker),
    );
    assert.deepEqual(await readdir(fixture.output), []);
  }
});

test("changed input artifacts reject before any report is published", async (t) => {
  const fixture = await fixtureRoot(t);
  let snapshots = 0;
  fixture.dependencies.snapshot = async () => {
    const current = clone(snapshot);
    if (snapshots++ > 0) current[0].sha256 = digest("mutated artifact");
    return current;
  };
  await assert.rejects(runAssistedSuite(fixture.options, fixture.dependencies), {
    code: "ASSISTED_ARTIFACT_CHANGED",
  });
  assert.deepEqual(await readdir(fixture.output), []);
});

test("simple invalid-argument process call emits only a redacted failure", async () => {
  const cli = fileURLToPath(new URL("../assisted-test-runner.mjs", import.meta.url));
  await assert.rejects(
    promisify(execFile)(process.execPath, [cli, "--suite", privateMarker, "--out", "owned"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 8192,
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.deepEqual(JSON.parse(error.stderr), {
        ok: false,
        code: "ASSISTED_ARGUMENT",
        redacted: true,
      });
      assert.equal(error.stderr.includes(privateMarker), false);
      return true;
    },
  );
});
