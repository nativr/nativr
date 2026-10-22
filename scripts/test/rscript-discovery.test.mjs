import assert from "node:assert/strict";
import test from "node:test";

import { findRscript, parseRscriptArguments } from "../lib/rscript-discovery.mjs";

const success = { status: 0, signal: null, stdout: "Rscript version (test)", stderr: "" };
const missing = { status: null, signal: null, error: { code: "ENOENT" } };
const entry = (name, directory = true) => ({ name, isDirectory: () => directory });
const userRoot = String.raw`C:\Users\Owned\AppData\Local\Programs\R`;
const systemRoot = String.raw`C:\Program Files\R`;
const installed = (root, version) => `${root}\\${version}\\bin\\Rscript.exe`;

function fake({ platform = "linux", env = {}, processes = {}, directories = {} } = {}) {
  const calls = [];
  const reads = [];
  return {
    calls,
    reads,
    dependencies: {
      platform,
      env,
      spawnSync(executable, arguments_, options) {
        calls.push({ executable, arguments_, options });
        const response = processes[executable] ?? missing;
        if (response instanceof Error) throw response;
        return response;
      },
      async readdir(directory, options) {
        reads.push({ directory, options });
        const response = directories[directory];
        if (response === undefined || response instanceof Error)
          throw response ?? new Error("Missing fake directory");
        return response;
      },
    },
  };
}

test("CLI override precedes environment, PATH, and installation discovery", async () => {
  const fixture = fake({
    platform: "win32",
    env: { NATIVR_RSCRIPT: "environment-r" },
    processes: { "explicit-r": success, "environment-r": success, Rscript: success },
  });
  assert.equal(await findRscript({ rscript: "explicit-r" }, fixture.dependencies), "explicit-r");
  assert.deepEqual(
    fixture.calls.map((call) => call.executable),
    ["explicit-r"],
  );
  assert.deepEqual(fixture.reads, []);
});

test("environment choice precedes PATH and discovery", async () => {
  const fixture = fake({
    env: { NATIVR_RSCRIPT: "environment-r" },
    processes: { "environment-r": success, Rscript: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), "environment-r");
  assert.deepEqual(
    fixture.calls.map((call) => call.executable),
    ["environment-r"],
  );
  assert.deepEqual(fixture.reads, []);
});

for (const source of ["--rscript", "NATIVR_RSCRIPT"]) {
  for (const required of [false, true]) {
    test(`invalid ${source} fails without fallback when required=${required}`, async () => {
      const fixture = fake({
        platform: "win32",
        env: source === "NATIVR_RSCRIPT" ? { NATIVR_RSCRIPT: "bad-r" } : {},
        processes: { Rscript: success },
      });
      await assert.rejects(
        findRscript(
          { required, ...(source === "--rscript" ? { rscript: "bad-r" } : {}) },
          fixture.dependencies,
        ),
        /selected by .* could not run --version/u,
      );
      assert.deepEqual(
        fixture.calls.map((call) => call.executable),
        ["bad-r"],
      );
      assert.deepEqual(fixture.reads, []);
    });
  }
}

for (const value of ["", "  ", "bad\0path", null]) {
  test(`invalid explicit executable ${JSON.stringify(value)} rejects before process access`, async () => {
    const fixture = fake({ processes: { Rscript: success } });
    await assert.rejects(
      findRscript({ rscript: value }, fixture.dependencies),
      /nonempty executable/u,
    );
    assert.deepEqual(fixture.calls, []);
    assert.deepEqual(fixture.reads, []);
  });
}

test("an empty configured environment override is an error, not optional absence", async () => {
  const fixture = fake({ env: { NATIVR_RSCRIPT: "" }, processes: { Rscript: success } });
  await assert.rejects(findRscript({}, fixture.dependencies), /NATIVR_RSCRIPT requires/u);
  assert.deepEqual(fixture.calls, []);
});

test("availability probe preserves a spaced executable as one shell-free argument and is bounded", async () => {
  const executable = String.raw`C:\Users\Owned Name\R\Rscript.exe`;
  const env = { PATH: "owned-path" };
  const fixture = fake({ env, processes: { [executable]: success } });
  assert.equal(await findRscript({ rscript: executable }, fixture.dependencies), executable);
  assert.deepEqual(fixture.calls, [
    {
      executable,
      arguments_: ["--version"],
      options: {
        env,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
        timeout: 5_000,
        maxBuffer: 65_536,
        stdio: ["ignore", "pipe", "pipe"],
      },
    },
  ]);
});

for (const [name, response] of [
  ["spawn error", missing],
  ["nonzero status", { status: 1, signal: null, stdout: "Rscript version 4.6.1" }],
  ["timeout", { status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT" } }],
  ["signal", { status: 0, signal: "SIGTERM" }],
  ["output limit", { status: null, signal: "SIGTERM", error: { code: "ENOBUFS" } }],
  ["thrown process failure", new Error("private process output must not escape")],
]) {
  test(`explicit ${name} cannot become success or an optional skip`, async () => {
    const fixture = fake({ processes: { "chosen-r": response, Rscript: success } });
    await assert.rejects(findRscript({ rscript: "chosen-r" }, fixture.dependencies), {
      message:
        "Rscript selected by --rscript could not run --version. Check that executable override; automatic discovery was not attempted.",
    });
    assert.equal(fixture.calls.length, 1);
  });
}

test("PATH precedes Windows directories", async () => {
  const fixture = fake({ platform: "win32", processes: { Rscript: success } });
  assert.equal(await findRscript({}, fixture.dependencies), "Rscript");
  assert.deepEqual(fixture.reads, []);
});

test("missing automatic oracle stays optional on non-Windows", async () => {
  const fixture = fake();
  assert.equal(await findRscript({}, fixture.dependencies), undefined);
  assert.deepEqual(
    fixture.calls.map((call) => call.executable),
    ["Rscript"],
  );
  assert.deepEqual(fixture.reads, []);
});

test("required commands fail when automatic discovery is exhausted", async () => {
  const fixture = fake();
  await assert.rejects(findRscript({ required: true }, fixture.dependencies), /GNU R is required/u);
});

test("Windows per-user installations precede Program Files and use natural descending names", async () => {
  const candidate = installed(userRoot, "R-4.10.0");
  const fixture = fake({
    platform: "win32",
    env: { LOCALAPPDATA: String.raw`C:\Users\Owned\AppData\Local` },
    directories: { [userRoot]: [entry("R-4.9.0"), entry("R-4.10.0"), entry("notes", false)] },
    processes: { [candidate]: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), candidate);
  assert.deepEqual(
    fixture.calls.map((call) => call.executable),
    ["Rscript", candidate],
  );
  assert.deepEqual(fixture.reads, [{ directory: userRoot, options: { withFileTypes: true } }]);
});

test("automatic broken installations are skipped without executing their R bodies", async () => {
  const broken = installed(userRoot, "R-4.7.0");
  const available = installed(userRoot, "R-4.6.1");
  const fixture = fake({
    platform: "win32",
    env: { LOCALAPPDATA: String.raw`C:\Users\Owned\AppData\Local` },
    directories: { [userRoot]: [entry("R-4.6.1"), entry("R-4.7.0")] },
    processes: { [broken]: { status: 1, signal: null }, [available]: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), available);
  assert.deepEqual(
    fixture.calls.map((call) => call.executable),
    ["Rscript", broken, available],
  );
  assert.ok(fixture.calls.every((call) => JSON.stringify(call.arguments_) === '["--version"]'));
});

test("USERPROFILE supplies the standard per-user root when LOCALAPPDATA is absent", async () => {
  const candidate = installed(userRoot, "R-4.6.1");
  const fixture = fake({
    platform: "win32",
    env: { USERPROFILE: String.raw`C:\Users\Owned` },
    directories: { [userRoot]: [entry("R-4.6.1")] },
    processes: { [candidate]: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), candidate);
  assert.equal(fixture.reads[0].directory, userRoot);
});

test("unreadable per-user root falls through to configured Program Files", async () => {
  const root = String.raw`D:\Owned Programs\R`;
  const candidate = installed(root, "R-4.6.1");
  const fixture = fake({
    platform: "win32",
    env: {
      LOCALAPPDATA: String.raw`C:\Users\Owned\AppData\Local`,
      ProgramFiles: String.raw`D:\Owned Programs`,
    },
    directories: { [userRoot]: new Error("unreadable"), [root]: [entry("R-4.6.1")] },
    processes: { [candidate]: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), candidate);
  assert.deepEqual(
    fixture.reads.map((read) => read.directory),
    [userRoot, root],
  );
});

test("Windows default Program Files root remains supported without per-user environment", async () => {
  const candidate = installed(systemRoot, "R-4.6.1");
  const fixture = fake({
    platform: "win32",
    directories: { [systemRoot]: [entry("R-4.6.1")] },
    processes: { [candidate]: success },
  });
  assert.equal(await findRscript({}, fixture.dependencies), candidate);
  assert.deepEqual(
    fixture.reads.map((read) => read.directory),
    [systemRoot],
  );
});

test("missing Windows roots remain optional unless required", async () => {
  const fixture = fake({ platform: "win32" });
  assert.equal(await findRscript({}, fixture.dependencies), undefined);
  await assert.rejects(findRscript({ required: true }, fixture.dependencies), /GNU R is required/u);
});

test("discovery leaves version policy to the caller instead of silently substituting another R", async () => {
  const fixture = fake({
    platform: "win32",
    env: { NATIVR_ALLOW_NON_NORMATIVE_R: "0" },
    processes: { Rscript: { ...success, stdout: "Rscript version 4.5.0" } },
  });
  assert.equal(await findRscript({}, fixture.dependencies), "Rscript");
  assert.deepEqual(fixture.reads, []);
  assert.equal(fixture.calls.length, 1);
});

test("conformance CLI accepts no override and pnpm separator", () => {
  assert.deepEqual(parseRscriptArguments([]), {});
  assert.deepEqual(parseRscriptArguments(["--"]), {});
  assert.deepEqual(parseRscriptArguments(["--", "--rscript", "owned Rscript"]), {
    rscript: "owned Rscript",
  });
});

for (const arguments_ of [
  ["--rscript"],
  ["--rscript", ""],
  ["--rscript", "  "],
  ["--rscript", "--other"],
  ["--rscript", "one", "--rscript", "two"],
  ["--unknown"],
  ["bare-path"],
]) {
  test(`conformance CLI rejects invalid arguments ${JSON.stringify(arguments_)}`, () => {
    assert.throws(() => parseRscriptArguments(arguments_));
  });
}
