import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const missingExecutable = path.join(root, ".tmp", `missing-rscript-${randomUUID()}.exe`);
const environment = {
  ...process.env,
  NATIVR_RSCRIPT: process.execPath,
  NATIVR_ALLOW_NON_NORMATIVE_R: "0",
};

for (const script of ["run-r-conformance.mjs", "run-r-conformance-v2.mjs", "package-check.mjs"]) {
  test(`${script} rejects a bad explicit oracle before collecting evidence`, () => {
    const output = path.join(root, ".tmp", `unused-oracle-report-${randomUUID()}.json`);
    const arguments_ = [path.join(root, "scripts", script), "--rscript", missingExecutable];
    if (script === "package-check.mjs")
      arguments_.push("--package", "pkgconfig", "--source", `${output}.tar.gz`, "--output", output);
    const result = spawnSync(process.execPath, arguments_, {
      cwd: root,
      env: environment,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 128 * 1024,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /selected by --rscript could not run --version/u);
    assert.doesNotMatch(result.stdout, /SKIP|PASS/u);
    assert.equal(existsSync(output), false);
  });
}

for (const script of ["run-r-conformance.mjs", "run-r-conformance-v2.mjs"]) {
  test(`${script} retains its version gate after a successful availability probe`, () => {
    // Node accepts --version but is deliberately not GNU R. No R installation is required.
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", script), "--rscript", process.execPath],
      {
        cwd: root,
        env: environment,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 15_000,
        maxBuffer: 128 * 1024,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires GNU R 4\.6\.1; found unknown/u);
    assert.doesNotMatch(result.stdout, /SKIP|PASS/u);
  });
}
