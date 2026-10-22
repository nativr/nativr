import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveRequiredExampleManifest,
  maximumManifestSourceBytes,
  parseRequiredExampleManifestArgs,
  requiredExampleTitle,
  RequiredExampleManifestError,
  verifyRequiredExampleManifest,
} from "../lib/required-example-manifest.mjs";

const wrap = (body) =>
  `import { expect, profiledRun, test } from "./helpers/required-example-profile.js";\ntest("${requiredExampleTitle}", async ({ page }) => {\n  test.setTimeout(120_000);\n${body}\n});\n`;
const run = (id) => `await profiledRun(page, "required-${id}");`;
const error = (code) => (value) =>
  value instanceof RequiredExampleManifestError && value.code === code;

test("manifest derives current identity, exact site lines and ordered occurrences", () => {
  const source = wrap(
    `${run("001")}\nfor (const code of ["first", "second"]) {\n${run("002")}\n${run("003")}\n}\n${run("004")}`,
  );
  const manifest = deriveRequiredExampleManifest(source);
  assert.deepEqual(manifest.sampleIds, [
    "required-001:1",
    "required-002:1",
    "required-003:1",
    "required-002:2",
    "required-003:2",
    "required-004:1",
  ]);
  assert.deepEqual(manifest.runSites, [
    { id: "required-001", occurrences: 1, line: 4 },
    { id: "required-002", occurrences: 2, line: 6 },
    { id: "required-003", occurrences: 2, line: 7 },
    { id: "required-004", occurrences: 1, line: 9 },
  ]);
  assert.equal(manifest.sourcePath, "tests/e2e/playground.spec.ts");
  assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/u);
  assert.equal("originalCommit" in manifest, false);
  assert.equal("sourceAndAssertionsBytePreserved" in manifest, false);
});

test("LF and CRLF share canonical source identity while changes invalidate it", () => {
  const source = wrap(run("001"));
  const manifest = deriveRequiredExampleManifest(source);
  assert.deepEqual(deriveRequiredExampleManifest(source.replaceAll("\n", "\r\n")), manifest);
  assert.throws(
    () => verifyRequiredExampleManifest(source.replace("120_000", "120000"), manifest),
    error("MANIFEST_STALE"),
  );
});

test("ordinary static example/preview clicks and non-activating nested callbacks remain allowed", () => {
  const source = wrap(
    `await page.getByRole("button", { name: "Vector mean" }).click();\nawait page.locator("#browse-requests").getByRole("button", { name: "Preview" }).click();\nconst inspect = () => { if (true) return "profiledRun(page, 'required-999')"; };\n${run("001")}`,
  );
  assert.deepEqual(deriveRequiredExampleManifest(source).sampleIds, ["required-001:1"]);
});

for (const [name, body, code] of [
  ["duplicate owned ID", `${run("001")}\n${run("001")}`, "MANIFEST_DUPLICATE_ID"],
  ["dynamic ID", "await profiledRun(page, id);", "MANIFEST_PROFILE_CALL"],
  ["unawaited run", 'profiledRun(page, "required-001");', "MANIFEST_PROFILE_CONTEXT"],
  [
    "nested callback run",
    `const action = async () => { ${run("001")} };`,
    "MANIFEST_PROFILE_CONTEXT",
  ],
  ["aliased profiler", `const action = profiledRun;\n${run("001")}`, "MANIFEST_PROFILE_REFERENCE"],
  ["conditional run", `if (condition) { ${run("001")} }`, "MANIFEST_CONTROL_FLOW"],
  ["early return", `return;\n${run("001")}`, "MANIFEST_CONTROL_FLOW"],
  ["dynamic for-of", `for (const value of inputs) { ${run("001")} }`, "MANIFEST_LOOP"],
  ["spread for-of", `for (const value of ["first", ...rest]) { ${run("001")} }`, "MANIFEST_LOOP"],
  ["empty for-of", `for (const value of []) { ${run("001")} }`, "MANIFEST_LOOP"],
  ["mutable for-of", `for (let value of ["first"]) { ${run("001")} }`, "MANIFEST_LOOP"],
  ["unreviewed while", `while (condition) { ${run("001")} }`, "MANIFEST_CONTROL_FLOW"],
  [
    "Run regex click",
    `await page.getByRole("button", { name: /^Run/u }).click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "Run string click",
    `await page.getByRole("button", { name: "Run code" }).click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "Run substring click",
    `await page.getByRole("button", { name: "un" }).click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "aliased click target",
    `await button.click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "unknown button name",
    `await page.getByRole("button", { name }).click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "spread click options",
    `await page.getByRole("button", { name: "Preview", ...options }).click();\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "keyboard shortcut",
    `await page.keyboard.press("Control+Enter");\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "DOM dispatch shortcut",
    `await page.locator("#run").dispatchEvent("click");\n${run("001")}`,
    "MANIFEST_UNPROFILED_ACTIVATION",
  ],
  [
    "extra run arguments",
    'await profiledRun(page, "required-001", options);',
    "MANIFEST_PROFILE_CALL",
  ],
  [
    "different page argument",
    'await profiledRun(otherPage, "required-001");',
    "MANIFEST_PROFILE_CALL",
  ],
])
  test(`manifest rejects ${name}`, () =>
    assert.throws(() => deriveRequiredExampleManifest(wrap(body)), error(code)));

test("manifest rejects duplicated target, changed timeout, bad import and parse errors", () => {
  const source = wrap(run("001"));
  assert.throws(
    () => deriveRequiredExampleManifest(source + source.slice(source.indexOf("test("))),
    error("MANIFEST_TARGET"),
  );
  assert.throws(
    () => deriveRequiredExampleManifest(source.replace("120_000", "240_000")),
    error("MANIFEST_TIMEOUT"),
  );
  assert.throws(
    () =>
      deriveRequiredExampleManifest(
        source.replace("profiledRun, test", "profiledRun as run, test"),
      ),
    error("MANIFEST_IMPORT"),
  );
  assert.throws(() => deriveRequiredExampleManifest(source + "{ "), error("MANIFEST_PARSE"));
});

test("bounded source, finite loop and aggregate sample limits reject before manifest output", () => {
  assert.throws(
    () => deriveRequiredExampleManifest(" ".repeat(maximumManifestSourceBytes + 1)),
    error("MANIFEST_SOURCE_LIMIT"),
  );
  const many = Array.from({ length: 33 }, () => '"x"').join(",");
  assert.throws(
    () => deriveRequiredExampleManifest(wrap(`for (const x of [${many}]) { ${run("001")} }`)),
    error("MANIFEST_LOOP"),
  );
  const medium = Array.from({ length: 23 }, () => '"x"').join(",");
  assert.throws(
    () =>
      deriveRequiredExampleManifest(
        wrap(`for (const x of [${medium}]) { for (const y of [${medium}]) { ${run("001")} } }`),
      ),
    error("MANIFEST_SAMPLE_LIMIT"),
  );
});

test("check rejects stale metadata, extra fields and missing IDs without rewriting", () => {
  const source = wrap(run("001"));
  const manifest = deriveRequiredExampleManifest(source);
  assert.deepEqual(verifyRequiredExampleManifest(source, structuredClone(manifest)), manifest);
  for (const changed of [
    { ...manifest, originalCommit: "old" },
    { ...manifest, sampleIds: [] },
    { ...manifest, runSites: [{ ...manifest.runSites[0], line: 999 }] },
  ])
    assert.throws(() => verifyRequiredExampleManifest(source, changed), error("MANIFEST_STALE"));
});

test("CLI defaults to read-only checking and requires explicit unique write option", () => {
  assert.equal(parseRequiredExampleManifestArgs([]), "check");
  assert.equal(parseRequiredExampleManifestArgs(["--check"]), "check");
  assert.equal(parseRequiredExampleManifestArgs(["--write"]), "write");
  for (const args of [
    ["--update"],
    ["--write", "--check"],
    ["--write", "--write"],
    ["../other.ts"],
  ])
    assert.throws(() => parseRequiredExampleManifestArgs(args), error("MANIFEST_ARGUMENTS"));
});

test("maintained owned fixture and manifest are synchronized", async () => {
  const source = await readFile(
    new URL("../../tests/e2e/playground.spec.ts", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("../../tests/e2e/helpers/required-example-profile-cases.json", import.meta.url),
      "utf8",
    ),
  );
  verifyRequiredExampleManifest(source, manifest);
});
