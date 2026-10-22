import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findRscript } from "../lib/rscript-discovery.mjs";

const root = fileURLToPath(new URL("./fixtures/package-test-coverage/", import.meta.url));
const rows = [
  ["direct-nested", "completed", "top-enter,nested,top-exit", "1", "NA", ""],
  ["guarded-unavailable", "completed", "top-enter,top-exit", "0", "FALSE", ""],
  ["no-entrypoint", "no-entrypoint", "", "0", "NA", ""],
  ["direct-only", "completed", "top-enter,top-exit", "0", "NA", ""],
  ["top-failure", "failed", "top-enter", "0", "NA", "owned top failure"],
];
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
const snapshot = () =>
  Object.fromEntries(
    files(root)
      .sort()
      .map((file) => [
        path.relative(root, file),
        createHash("sha256").update(readFileSync(file)).digest("hex"),
      ]),
  );

test(
  "owned nested-test execution facts against GNU R 4.6.1",
  {
    skip: process.env.NATIVR_RUN_NATIVE_PACKAGE_COVERAGE !== "1",
  },
  async (context) => {
    const rscript = await findRscript({ required: true });
    const before = snapshot();
    for (const [id, outcome, events, nestedCount, runnerAvailable, errorMessage] of rows) {
      await context.test(id, () => {
        const output = execFileSync(
          rscript,
          ["--vanilla", path.join(root, "native-harness.R"), path.join(root, "cases", id)],
          {
            cwd: root,
            env: { ...process.env, LC_ALL: "C", LC_CTYPE: "C", LANG: "C" },
            encoding: "utf8",
            timeout: 15000,
            maxBuffer: 65536,
            windowsHide: true,
          },
        );
        const lines = output.split(/\r?\n/u).filter((line) => line.length > 0);
        assert.equal(lines.length, 10);
        const observed = Object.fromEntries(
          lines.map((line) => {
            const index = line.indexOf("\t");
            assert.ok(index > 0);
            return [line.slice(0, index), line.slice(index + 1)];
          }),
        );
        assert.deepEqual(observed, {
          rVersion: "4.6.1",
          outcome,
          entrypoints: id === "no-entrypoint" ? "" : "tests/top.R",
          nestedRFiles: id === "direct-only" ? "" : "tests/helpers/nested.R",
          attemptedEntrypoints: id === "no-entrypoint" ? "" : "tests/top.R",
          events,
          nestedCount,
          runnerAvailable,
          errorMessage,
          errorClasses: id === "top-failure" ? "simpleError,error,condition" : "",
        });
      });
    }
    assert.deepEqual(snapshot(), before);
  },
);
