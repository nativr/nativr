import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format } from "prettier";
import formatting from "../prettier.config.mjs";
import {
  EvidenceFault,
  SETTINGS,
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
} from "./lib/package-evidence.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const fail = (code) => {
  throw new EvidenceFault(code);
};
const within = (root, target, pathApi = path) => {
  const relative = pathApi.relative(root, target);
  return (
    relative !== "" &&
    !relative.startsWith(".." + pathApi.sep) &&
    relative !== ".." &&
    !pathApi.isAbsolute(relative)
  );
};
// Hash the canonical bytes that can be retained unchanged by repository formatting checks.
const jsonBytes = async (value) =>
  Buffer.from(await format(JSON.stringify(value), { ...formatting, parser: "json" }));

/** No shell, inherited terminal output, downloads, or source-shaped failure text. */
export function runBoundedProcess({ file, args, cwd, timeoutMs, captureLimit = 0 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, LC_ALL: "C", LC_CTYPE: "C", LANG: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const hashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
    const sizes = { stdout: 0, stderr: 0 };
    const stdout = [];
    let reason;
    let fallback;
    let killer;
    let killerTimer;
    let childClosed = false;
    let treeVerified = false;
    let treeFailed = false;
    let settled = false;
    const stopKiller = () => {
      clearTimeout(killerTimer);
      if (!killer) return;
      const helper = killer;
      killer = undefined;
      try {
        helper.kill("SIGKILL");
      } catch {
        /* Explicit termination failure remains recorded. */
      }
      helper.unref();
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      stopKiller();
      if (error) reject(error);
      else resolve(result);
    };
    const finishTermination = () => {
      if (childClosed && (treeVerified || treeFailed))
        finish(new EvidenceFault(treeFailed ? "EVIDENCE_CHILD_TERMINATION" : reason));
    };
    const directKill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* The bounded fallback still rejects explicitly. */
      }
    };
    const failedTreeTermination = () => {
      if (settled) return;
      treeFailed = true;
      stopKiller();
      directKill();
      finishTermination();
    };
    const stop = (code) => {
      if (reason) return;
      reason = code;
      fallback = setTimeout(() => {
        treeFailed = true;
        stopKiller();
        directKill();
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        finish(new EvidenceFault("EVIDENCE_CHILD_TERMINATION"));
      }, 10000);
      // Kill the process tree: the checker may have an active native child.
      if (process.platform === "win32" && child.pid) {
        killer = spawn(
          path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"),
          ["/PID", String(child.pid), "/T", "/F"],
          { shell: false, windowsHide: true, stdio: "ignore" },
        );
        // A restricted host can block taskkill. Its helper must not outlive our bounded attempt.
        killerTimer = setTimeout(failedTreeTermination, 2000);
        killer.on("error", failedTreeTermination);
        killer.on("close", (exitCode, signal) => {
          if (settled || treeFailed) return;
          clearTimeout(killerTimer);
          if (exitCode !== 0 || signal !== null) return failedTreeTermination();
          treeVerified = true;
          finishTermination();
        });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
          treeVerified = true;
        } catch {
          failedTreeTermination();
        }
      }
    };
    const timer = setTimeout(() => stop("EVIDENCE_CHILD_TIMEOUT"), timeoutMs);
    for (const stream of ["stdout", "stderr"])
      child[stream].on("data", (chunk) => {
        hashes[stream].update(chunk);
        sizes[stream] += chunk.length;
        if (stream === "stdout" && captureLimit > 0 && sizes.stdout <= captureLimit)
          stdout.push(chunk);
        if (
          sizes.stdout + sizes.stderr > SETTINGS.maxProcessOutputBytes ||
          (captureLimit > 0 && sizes.stdout > captureLimit)
        )
          stop("EVIDENCE_CHILD_OUTPUT_LIMIT");
      });
    child.on("error", () => finish(new EvidenceFault("EVIDENCE_CHILD_START")));
    child.on("close", (exitCode, signal) => {
      childClosed = true;
      if (reason) return finishTermination();
      finish(null, {
        exitCode,
        signal,
        stdout: Buffer.concat(stdout),
        output: Object.fromEntries(
          ["stdout", "stderr"].map((name) => [
            name,
            { bytes: sizes[name], sha256: hashes[name].digest("hex") },
          ]),
        ),
      });
    });
  });
}

async function readBounded(file, maximum = SETTINGS.maxReportBytes) {
  const information = await stat(file);
  if (!information.isFile() || information.size > maximum) fail("EVIDENCE_INPUT_SIZE");
  return readFile(file);
}

async function hashFile(file, label) {
  const information = await stat(file);
  if (!information.isFile()) fail("EVIDENCE_INPUT_FILE");
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  if (bytes !== information.size) fail("EVIDENCE_ARTIFACT_CHANGED");
  return { path: label, bytes, sha256: hash.digest("hex") };
}

/** Hash only: package archives are opaque execution inputs, never inspected here. */
export async function snapshotInputs(root, inputs) {
  const files = [];
  async function add(relative) {
    files.push(await hashFile(path.join(root, relative), relative));
  }
  async function tree(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail("EVIDENCE_SNAPSHOT_LINK");
      const child = relative + "/" + entry.name;
      if (entry.isDirectory()) await tree(child);
      else if (entry.isFile()) await add(child);
      else fail("EVIDENCE_INPUT_FILE");
    }
  }
  for (const relative of [
    "package.json",
    "pnpm-lock.yaml",
    "docs/compatibility-manifest.json",
    "compatibility/package-corpus.json",
    "prettier.config.mjs",
    "scripts/package-evidence.mjs",
    "scripts/package-check.mjs",
    "scripts/capability-manifest.mjs",
  ])
    await add(relative);
  await tree("scripts/lib");
  for (const name of ["ast", "base", "nativr", "package-tools", "parser", "protocol", "runtime"]) {
    await add(`packages/${name}/package.json`);
    await tree(`packages/${name}/src`);
    await tree(`packages/${name}/dist`);
  }
  for (const input of inputs) files.push(await hashFile(input.file, input.label));
  return validateSnapshot(files);
}

export async function assertDirectoryBoundary(
  root,
  target,
  { inspect = lstat, resolve = realpath, code = "EVIDENCE_OUTPUT_PATH", pathApi = path } = {},
) {
  if (!within(root, target, pathApi)) fail(code);
  for (let ancestor = target; pathApi.relative(root, ancestor) !== "";) {
    try {
      const information = await inspect(ancestor);
      if (information.isSymbolicLink()) fail(code);
      const resolved = await resolve(ancestor);
      if (pathApi.relative(root, resolved) !== "" && !within(root, resolved, pathApi)) fail(code);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = pathApi.dirname(ancestor);
    if (parent === ancestor) fail(code);
    ancestor = parent;
  }
}

async function newOutputDirectory(root, requested) {
  const target = path.resolve(root, requested);
  const rawRoot = path.join(root, ".tmp/package-evidence-raw");
  if (
    !within(root, target) ||
    path.relative(rawRoot, target) === "" ||
    within(target, rawRoot) ||
    within(rawRoot, target)
  )
    fail("EVIDENCE_OUTPUT_PATH");
  // Check every existing ancestor before creating directories; symlinks may escape the workspace.
  await assertDirectoryBoundary(root, target);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await mkdir(target);
  } catch (error) {
    if (error.code === "EEXIST") fail("EVIDENCE_OUTPUT_EXISTS");
    throw error;
  }
  return target;
}

/** Injection is for fixture tests; the CLI always derives its repository from import.meta.url. */
export async function runEvidence(
  options,
  {
    root = repositoryRoot,
    processRunner = runBoundedProcess,
    nodePath = process.execPath,
    host = { platform: process.platform, arch: process.arch, nodeVersion: process.version },
    now = () => new Date().toISOString(),
  } = {},
) {
  root = await realpath(root);
  let phase = "preflight";
  let output;
  let expected;
  let before;
  let after;
  let head;
  let snapshot;
  const results = [];
  const failures = [];
  const run = (file, args, timeoutMs = 30000, captureLimit = 65536) =>
    processRunner({ file, args, cwd: root, timeoutMs, captureLimit });
  const git = async (args) => {
    const result = await run("git", args);
    if (result.exitCode !== 0 || result.signal !== null) fail("EVIDENCE_GIT");
    return result.stdout.toString("utf8").trim();
  };
  try {
    output = await newOutputDirectory(root, options.output);
    if (!/^v24\.\d+\.\d+$/.test(host.nodeVersion)) fail("EVIDENCE_HOST");
    const manifestBytes = await readBounded(path.join(root, "docs/compatibility-manifest.json"));
    const manifest = JSON.parse(manifestBytes);
    const identity = validateManifest(manifest);
    const corpusBytes = await readBounded(path.join(root, "compatibility/package-corpus.json"));
    const corpus = JSON.parse(corpusBytes);
    const packages = selectPackages(corpus, options.packages);
    const archiveRoot = await realpath(path.resolve(root, options["archive-dir"]));
    const rscript = await realpath(path.resolve(root, options.rscript));
    await access(rscript);
    const inputs = [
      { file: rscript, label: "inputs/rscript-executable" },
      { file: nodePath, label: "inputs/node-executable" },
    ];
    const verifiedHashes = new Map([
      ["docs/compatibility-manifest.json", sha256(manifestBytes)],
      ["compatibility/package-corpus.json", sha256(corpusBytes)],
    ]);
    const observations = new Map();
    const archives = new Map();
    for (const entry of packages) {
      const archive = await realpath(
        path.join(archiveRoot, `${entry.name}_${entry.version}.tar.gz`),
      );
      if (!within(archiveRoot, archive)) fail("EVIDENCE_ARCHIVE_PATH");
      verifyArchive(await readBounded(archive), entry);
      verifiedHashes.set(`inputs/${entry.name}-archive`, entry.sourceSha256);
      archives.set(entry.name, archive);
      inputs.push({ file: archive, label: `inputs/${entry.name}-archive` });
      const baseline = path.join(
        root,
        `compatibility/package-check-evidence/${options["baseline-profile"]}/${entry.name}.json`,
      );
      const baselineBytes = await readBounded(baseline, 8388608);
      observations.set(
        entry.name,
        validateBaseline(JSON.parse(baselineBytes), entry, options["baseline-profile"]),
      );
      verifiedHashes.set(`inputs/${entry.name}-baseline`, sha256(baselineBytes));
      inputs.push({ file: baseline, label: `inputs/${entry.name}-baseline` });
    }
    await git(["check-ignore", "--quiet", "--", ".tmp/package-evidence-raw/probe"]);
    head = await git(["rev-parse", "HEAD"]);
    if (!/^[a-f0-9]{40,64}$/.test(head)) fail("EVIDENCE_HEAD");
    expected = { ...identity, packages, baselineProfile: options["baseline-profile"] };
    snapshot = () => snapshotInputs(root, inputs);
    before = await snapshot();
    for (const [label, hash] of verifiedHashes)
      if (before.find((entry) => entry.path === label)?.sha256 !== hash)
        fail("EVIDENCE_ARTIFACT_CHANGED");
    if (!options.run) {
      const preflight = {
        schemaVersion: 1,
        kind: "nativr-offline-package-preflight",
        ok: true,
        recordedAt: now(),
        head,
        ...identity,
        packages,
        settings: SETTINGS,
        baselineProfile: options["baseline-profile"],
        provenance: before,
        execution: "not-requested",
        oracleVersionVerified: false,
        runtimeCapabilitiesVerified: false,
        convertedArtifactPinsVerified: false,
        limitations: [
          "Preflight verifies cached file pins and prerequisites only. Explicit --run is required for executable evidence.",
        ],
      };
      await writeFile(path.join(output, "preflight.json"), await jsonBytes(preflight), {
        flag: "wx",
      });
      return preflight;
    }
    await mkdir(path.join(root, ".tmp"), { recursive: true });
    await assertDirectoryBoundary(root, path.join(root, ".tmp"), {
      code: "EVIDENCE_QUARANTINE_PATH",
    });
    const rawRoot = path.join(root, ".tmp/package-evidence-raw");
    await mkdir(rawRoot, { recursive: true });
    await assertDirectoryBoundary(root, rawRoot, { code: "EVIDENCE_QUARANTINE_PATH" });
    const quarantine = await mkdtemp(path.join(rawRoot, "run-"));
    phase = "capabilities";
    const capabilities = await run(
      nodePath,
      [path.join(root, "scripts/capability-manifest.mjs"), "--check"],
      120000,
      0,
    );
    if (capabilities.exitCode !== 0 || capabilities.signal !== null) fail("EVIDENCE_CAPABILITIES");
    phase = "oracle";
    const oracle = await run(rscript, ["--vanilla", "-e", "cat(as.character(getRversion()))"]);
    if (
      oracle.exitCode !== 0 ||
      oracle.signal !== null ||
      oracle.stdout.toString("utf8").trim() !== "4.6.1"
    )
      fail("EVIDENCE_ORACLE_VERSION");
    for (const entry of packages) {
      phase = "package";
      try {
        const rawFile = path.join(quarantine, entry.name + ".json");
        const child = await run(
          nodePath,
          packageCheckArguments(root, entry, archives.get(entry.name), rawFile, rscript),
          SETTINGS.packageTimeoutMs,
          0,
        );
        // Private metadata has only controlled process fields/hashes; raw diagnostics are discarded.
        await writeFile(
          path.join(quarantine, entry.name + "-process.json"),
          await jsonBytes({
            exitCode: child.exitCode,
            signal: child.signal,
            output: child.output,
          }),
          { flag: "wx" },
        );
        if (child.signal !== null) fail("EVIDENCE_CHILD_EXIT");
        const raw = await readBounded(rawFile);
        const summary = validatePackageReport(
          raw,
          { ...identity, entry, observations: observations.get(entry.name) },
          child.exitCode,
        );
        phase = "summary";
        const bytes = await jsonBytes(summary);
        await writeFile(path.join(output, entry.name + ".json"), bytes, { flag: "wx" });
        results.push({
          name: entry.name,
          validated: true,
          p7Eligible: summary.p7Eligible,
          summarySha256: sha256(bytes),
        });
      } catch (error) {
        failures.push({ stage: phase, error });
      }
    }
  } catch (error) {
    failures.push({ stage: phase, error });
  }
  if (before && snapshot) {
    try {
      after = await snapshot();
      if (head !== (await git(["rev-parse", "HEAD"]))) fail("EVIDENCE_HEAD_CHANGED");
    } catch (error) {
      failures.push({ stage: "stability", error });
    }
  }
  let report;
  if (before && after && expected && head) {
    report = evidenceIndex({
      expected,
      results,
      before,
      after,
      host,
      head,
      recordedAt: now(),
      failures,
    });
  } else {
    report = {
      schemaVersion: 1,
      kind: "nativr-offline-package-evidence-failure",
      ok: false,
      failures: failures.map(({ stage, error }) => safeFailure(stage, error)),
      redaction: { rawOutputIncluded: false, sourceIncluded: false },
    };
  }
  if (output)
    await writeFile(path.join(output, "index.json"), await jsonBytes(report), { flag: "wx" });
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = await runEvidence(parseEvidenceArguments(process.argv.slice(2)));
    console.log(
      JSON.stringify({ kind: report.kind, ok: report.ok, failures: report.failures ?? [] }),
    );
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, failure: safeFailure("arguments", error) }));
    process.exitCode = 1;
  }
}
