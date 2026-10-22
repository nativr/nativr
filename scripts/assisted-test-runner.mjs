import assert from "node:assert/strict";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format } from "prettier";
import formatting from "../prettier.config.mjs";
import { assertDirectoryBoundary, runBoundedProcess } from "./package-evidence.mjs";
import { readOwnedRunnerBundle, readOwnedRunnerSuite } from "./lib/assisted-test-runner/bundle.mjs";
import { capturedRunMetadata, prepareCapturedRun } from "./lib/assisted-test-runner/capture.mjs";
import { sha256, validateAssistedReport } from "./lib/assisted-test-runner/projection.mjs";
import { fixtureMetadata } from "./lib/assisted-test-runner/suite.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const MAX_CHILD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
export class AssistedSuiteError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (condition, code) => {
  if (!condition) throw new AssistedSuiteError(code);
};
const keys = (value, fields) => {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "ASSISTED_SHAPE");
  need(Object.keys(value).sort().join("|") === [...fields].sort().join("|"), "ASSISTED_FIELDS");
};
const canonicalBytes = async (value) =>
  Buffer.from(await format(JSON.stringify(value), { ...formatting, parser: "json" }));

export function parseAssistedArguments(args) {
  if (args[0] === "--") args = args.slice(1);
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index],
      value = args[index + 1];
    need(["--suite", "--out"].includes(flag), "ASSISTED_ARGUMENT");
    const key = flag.slice(2);
    need(
      !(key in result) &&
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 500 &&
        !value.includes("\0") &&
        !value.startsWith("--"),
      "ASSISTED_ARGUMENT",
    );
    result[key] = value;
  }
  need(result.suite === "core" && typeof result.out === "string", "ASSISTED_ARGUMENT");
  return result;
}

/** All content hashes describe local inputs, never implementation bodies in public artifacts. */
export async function snapshotAssistedInputs(root) {
  const files = [
    "docs/compatibility-manifest.json",
    "package.json",
    "pnpm-lock.yaml",
    "scripts/assisted-test-runner.mjs",
    "scripts/package-evidence.mjs",
    "scripts/lib/package-evidence.mjs",
    "scripts/lib/package-check-summary.mjs",
  ];
  async function walk(relative) {
    const directory = await lstat(path.join(root, relative));
    need(directory.isDirectory() && !directory.isSymbolicLink(), "ASSISTED_INPUT_LINK");
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      need(!entry.isSymbolicLink(), "ASSISTED_INPUT_LINK");
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.push(child);
      else throw new AssistedSuiteError("ASSISTED_INPUT_TYPE");
    }
  }
  await walk("testing/nativr-test-runner");
  await walk("scripts/lib/assisted-test-runner");
  for (const name of ["ast", "parser", "runtime", "base", "protocol", "nativr"]) {
    await walk(`packages/${name}/src`);
    await walk(`packages/${name}/dist`);
  }
  const records = [];
  for (const relative of files.sort()) {
    const file = path.join(root, relative),
      information = await lstat(file);
    need(
      information.isFile() && !information.isSymbolicLink() && information.size <= MAX_INPUT_BYTES,
      "ASSISTED_INPUT_SIZE",
    );
    const bytes = await readFile(file);
    need(bytes.length <= MAX_INPUT_BYTES, "ASSISTED_INPUT_SIZE");
    records.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return records;
}

/** Derive acceptance from the pinned owned suite; a failed fixture remains a failed report. */
export function validateSuiteResult(result, suite, runnerBundle, capabilities) {
  keys(result, ["kind", "schemaVersion", "results"]);
  need(
    result.kind === "nativr-owned-assisted-suite-result" && result.schemaVersion === 1,
    "ASSISTED_RESULT_KIND",
  );
  need(
    Array.isArray(result.results) && result.results.length === suite.fixtures.length,
    "ASSISTED_RESULT_COUNT",
  );
  return suite.fixtures.map((fixture, index) => {
    need(
      typeof fixture.id === "string" && /^[a-z][a-z0-9-]{0,80}$/.test(fixture.id),
      "ASSISTED_FIXTURE_ID",
    );
    const row = result.results[index];
    keys(row, fixture.expected.rejection ? ["id", "rejectionCode"] : ["id", "report"]);
    need(row.id === fixture.id, "ASSISTED_RESULT_ID");
    if (fixture.expected.rejection) {
      need(row.rejectionCode === fixture.expected.rejection, "ASSISTED_UNEXPECTED_REJECTION");
      return { id: fixture.id, expectationMatched: true, rejectionCode: row.rejectionCode };
    }
    const validated = validateAssistedReport(row.report);
    const plan = prepareCapturedRun(
      fixtureMetadata(fixture, runnerBundle.runner, capabilities),
      [{ path: fixture.path, source: fixture.source }],
      runnerBundle.bundle,
      fixture.controls,
    );
    const expected = capturedRunMetadata(plan);
    try {
      assert.deepEqual(row.report.runner, expected.runner);
      assert.deepEqual(row.report.input, expected.input);
      for (const [key, value] of Object.entries(expected.execution))
        assert.deepEqual(row.report.execution[key], value);
    } catch {
      throw new AssistedSuiteError("ASSISTED_REPORT_IDENTITY");
    }
    need(row.report.execution.outcome === fixture.expected.outcome, "ASSISTED_EXPECTATION");
    if (fixture.expected.testOutcome)
      need(
        row.report.events.some(
          (e) => e.type === "test-end" && e.outcome === fixture.expected.testOutcome,
        ),
        "ASSISTED_EXPECTATION",
      );
    return {
      id: fixture.id,
      expectationMatched: true,
      report: validated.report,
      derived: validated.derived,
    };
  });
}

/** Dependency injection is limited to owned tests; command-line callers cannot supply it. */
export async function runAssistedSuite(
  options,
  {
    root = repositoryRoot,
    processRunner = runBoundedProcess,
    loadBundle = readOwnedRunnerBundle,
    loadSuite = readOwnedRunnerSuite,
    snapshot = snapshotAssistedInputs,
  } = {},
) {
  options = parseAssistedArguments(["--suite", options.suite, "--out", options.out]);
  const output = path.resolve(root, options.out);
  const allowed = path.join(root, ".tmp", "assisted-test-runs");
  const relative = path.relative(allowed, output);
  need(
    relative !== "" &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
    "ASSISTED_OUTPUT_PATH",
  );
  await assertDirectoryBoundary(root, output);
  const before = await snapshot(root);
  const runnerBundle = await loadBundle(),
    suite = await loadSuite(options.suite);
  need(suite.id === options.suite && suite.fixtures.length > 0, "ASSISTED_SUITE");
  need(
    new Set(suite.fixtures.map((fixture) => fixture.id)).size === suite.fixtures.length,
    "ASSISTED_FIXTURE_ID",
  );
  const manifestPath = path.join(root, "docs/compatibility-manifest.json");
  const manifestInfo = await lstat(manifestPath);
  need(
    manifestInfo.isFile() && !manifestInfo.isSymbolicLink() && manifestInfo.size <= MAX_INPUT_BYTES,
    "ASSISTED_INPUT_SIZE",
  );
  const manifest = await readFile(manifestPath);
  need(manifest.length <= MAX_INPUT_BYTES, "ASSISTED_INPUT_SIZE");
  const capabilities = JSON.parse(manifest);
  need(
    typeof capabilities.semanticProfileVersion === "string" &&
      capabilities.semanticProfileVersion === capabilities.languageSubsetVersion,
    "ASSISTED_PROFILE",
  );
  await mkdir(path.dirname(output), { recursive: true });
  try {
    await mkdir(output);
  } catch (error) {
    if (error.code === "EEXIST") throw new AssistedSuiteError("ASSISTED_OUTPUT_EXISTS");
    throw error;
  }
  const child = await processRunner({
    file: process.execPath,
    args: [path.join(root, "scripts/lib/assisted-test-runner/execute.mjs"), options.suite],
    cwd: root,
    timeoutMs: 120_000,
    captureLimit: MAX_CHILD_BYTES,
  });
  need(child.exitCode === 0 && child.signal === null, "ASSISTED_CHILD_FAILED");
  need(
    child.stdout instanceof Uint8Array && child.stdout.length <= MAX_CHILD_BYTES,
    "ASSISTED_CHILD_BYTES",
  );
  let raw;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(child.stdout));
  } catch {
    throw new AssistedSuiteError("ASSISTED_CHILD_JSON");
  }
  const rows = validateSuiteResult(raw, suite, runnerBundle, capabilities);
  try {
    assert.deepEqual(await snapshot(root), before);
  } catch {
    throw new AssistedSuiteError("ASSISTED_ARTIFACT_CHANGED");
  }
  const results = [];
  for (const row of rows) {
    if (!row.report) {
      results.push(row);
      continue;
    }
    const file = `${row.id}.json`,
      bytes = await canonicalBytes(row.report);
    await writeFile(path.join(output, file), bytes, { flag: "wx" });
    results.push({
      id: row.id,
      expectationMatched: true,
      outcome: row.report.execution.outcome,
      report: file,
      reportSha256: sha256(bytes),
      ...row.derived,
    });
  }
  const checkpoint = {
    kind: "nativr-owned-assisted-suite-checkpoint",
    schemaVersion: 1,
    ok: true,
    recordedAt: new Date().toISOString(),
    suite: suite.id,
    suiteManifestSha256: suite.manifestSha256,
    semanticProfile: capabilities.semanticProfileVersion,
    capabilitySha256: sha256(JSON.stringify(capabilities)),
    normativeTierCredit: false,
    originalDependencyClosureSatisfied: false,
    realTestthatParity: false,
    host: { platform: process.platform, arch: process.arch, nodeVersion: process.version },
    stableArtifacts: true,
    runner: runnerBundle.runner,
    provenance: before,
    results,
  };
  await writeFile(path.join(output, "index.json"), await canonicalBytes(checkpoint), {
    flag: "wx",
  });
  return checkpoint;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = await runAssistedSuite(parseAssistedArguments(process.argv.slice(2)));
    console.log(
      JSON.stringify({
        kind: report.kind,
        ok: report.ok,
        suite: report.suite,
        fixtures: report.results.length,
        normativeTierCredit: false,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error instanceof AssistedSuiteError ? error.code : "ASSISTED_OPERATION_FAILED",
        redacted: true,
      }),
    );
    process.exitCode = 1;
  }
}
