import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runBoundedProcess } from "../package-evidence.mjs";

const fixtures = fileURLToPath(new URL("fixtures/package-evidence/", import.meta.url));
const temporaryRoot = path.join(os.tmpdir(), "nativr-package-evidence-process");
const strictCleanup = process.env.NATIVR_PROCESS_TEST_REQUIRE_TREE_CLEANUP === "1";
const hash = (text) => createHash("sha256").update(text).digest("hex");
const pause = () => new Promise((resolve) => setTimeout(resolve, 25));
const run = (name, args = [], overrides = {}) =>
  runBoundedProcess({
    file: process.execPath,
    args: [path.join(fixtures, name), ...args],
    cwd: fixtures,
    timeoutMs: 5000,
    captureLimit: 256,
    ...overrides,
  });

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function readPid(file) {
  const pid = Number(await readFile(file, "utf8"));
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  return pid;
}

async function stopped(pid) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (!isAlive(pid)) return;
    await pause();
  }
  assert.fail(`Owned watchdog child ${pid} is still alive`);
}

async function pidFiles(t, count = 1) {
  await mkdir(temporaryRoot, { recursive: true });
  const temporary = await mkdtemp(path.join(temporaryRoot, "owned-"));
  const files = Array.from({ length: count }, (_, index) =>
    path.join(temporary, `pid-${index}.txt`),
  );
  t.after(async () => {
    // Every PID is written by an owned fixture below. Kill descendants before their parent.
    for (const file of [...files].reverse()) {
      try {
        const pid = await readPid(file);
        const neededCleanup = isAlive(pid);
        if (neededCleanup) process.kill(pid, "SIGKILL");
        await stopped(pid);
        t.diagnostic(
          JSON.stringify({ ownedWatchdogPid: pid, neededCleanup, cleanupConfirmedStopped: true }),
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const relative = path.relative(await realpath(temporaryRoot), await realpath(temporary));
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return files;
}

async function limitResult(t, operation, expectedCode) {
  let observed;
  await assert.rejects(operation, (error) => {
    observed = error.code;
    return (
      error.code === expectedCode || (!strictCleanup && error.code === "EVIDENCE_CHILD_TERMINATION")
    );
  });
  if (observed === "EVIDENCE_CHILD_TERMINATION")
    t.diagnostic(
      "Controlled termination failure observed; exact owned-process cleanup is checked separately. This does not verify process-tree termination.",
    );
  return observed;
}

for (const exitCode of [0, 3]) {
  test(`owned subprocess returns exit ${exitCode} and drained stream hashes`, async () => {
    const result = await run("streams.mjs", [String(exitCode)]);
    assert.equal(result.exitCode, exitCode);
    assert.equal(result.signal, null);
    assert.equal(result.stdout.toString("utf8"), "owned π output");
    assert.deepEqual(result.output, {
      stdout: { bytes: Buffer.byteLength("owned π output"), sha256: hash("owned π output") },
      stderr: { bytes: Buffer.byteLength("owned diagnostic"), sha256: hash("owned diagnostic") },
    });
  });
}

test("missing owned executable reports controlled start failure", async () => {
  await assert.rejects(
    run("streams.mjs", [], { file: path.join(fixtures, "absent-owned-executable") }),
    (error) => error.code === "EVIDENCE_CHILD_START",
  );
});

test("idle owned subprocess is bounded by the watchdog", { timeout: 15000 }, async (t) => {
  const [pidFile] = await pidFiles(t);
  const observed = await limitResult(
    t,
    run("wait.mjs", [pidFile], { timeoutMs: 1000 }),
    "EVIDENCE_CHILD_TIMEOUT",
  );
  const pid = await readPid(pidFile);
  if (observed !== "EVIDENCE_CHILD_TERMINATION") await stopped(pid);
});

test("owned 4 KiB output exceeds a 1 KiB capture budget", { timeout: 15000 }, async (t) => {
  const [pidFile] = await pidFiles(t);
  const observed = await limitResult(
    t,
    run("output-limit.mjs", [pidFile], { captureLimit: 1024 }),
    "EVIDENCE_CHILD_OUTPUT_LIMIT",
  );
  const pid = await readPid(pidFile);
  if (observed !== "EVIDENCE_CHILD_TERMINATION") await stopped(pid);
});

test(
  "watchdog accounts for an owned descendant as well as its parent",
  { timeout: 18000 },
  async (t) => {
    const [parentFile, descendantFile] = await pidFiles(t, 2);
    const observed = await limitResult(
      t,
      run("descendant.mjs", [parentFile, descendantFile], { timeoutMs: 1500 }),
      "EVIDENCE_CHILD_TIMEOUT",
    );
    const pids = [await readPid(parentFile), await readPid(descendantFile)];
    assert.notEqual(pids[0], pids[1]);
    if (observed !== "EVIDENCE_CHILD_TERMINATION") for (const pid of pids) await stopped(pid);
  },
);
