import { spawn, spawnSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const exactnessPolicies = new Set([
  "exact",
  "bitwise",
  "ulp-bounded",
  "absolute-relative",
  "structural",
  "statistical",
  "platform-adapted",
  "explicit-deviation",
]);
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cases = JSON.parse(
  await readFile(path.join(root, "conformance", "cases", "oracle-v2.json"), "utf8"),
);
const capabilities = JSON.parse(
  await readFile(path.join(root, "docs", "compatibility-manifest.json"), "utf8"),
);
const evidenceBindings = new Set(
  capabilities.packages.flatMap((package_) =>
    [...package_.functions, ...(package_.bindings ?? [])]
      .filter(
        (definition) =>
          definition.compatibility === "behavioral" || definition.compatibility === "numeric",
      )
      .map((definition) => `${package_.name}::${definition.name}`),
  ),
);
for (const testCase of cases) {
  if (!exactnessPolicies.has(testCase.policy)) {
    throw new Error(`Oracle-v2 case '${testCase.id}' has unknown policy '${testCase.policy}'.`);
  }
  if (testCase.policy !== "exact" && testCase.policy !== "absolute-relative") {
    throw new Error(`Oracle-v2 policy '${testCase.policy}' is declared but not implemented yet.`);
  }
  if (testCase.policy === "absolute-relative") {
    const { absolute, relative } = testCase.tolerance ?? {};
    if (!Number.isFinite(absolute) || absolute < 0 || !Number.isFinite(relative) || relative < 0) {
      throw new Error(
        `Oracle-v2 case '${testCase.id}' requires finite non-negative absolute and relative tolerances.`,
      );
    }
  }
  if (
    !Array.isArray(testCase.bindings) ||
    testCase.bindings.length === 0 ||
    testCase.bindings.some((binding) => typeof binding !== "string")
  ) {
    throw new Error(`Oracle-v2 case '${testCase.id}' must declare behavioral registry bindings.`);
  }
  for (const binding of testCase.bindings) {
    if (!evidenceBindings.has(binding)) {
      throw new Error(
        `Oracle-v2 case '${testCase.id}' references a non-evidenced or unknown binding '${binding}'.`,
      );
    }
  }
}

const requestedCaseIds = new Set(
  (process.env.NATIVR_ORACLE_CASE ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const selectedCases =
  requestedCaseIds.size === 0
    ? cases
    : cases.filter((testCase) => requestedCaseIds.has(testCase.id));
if (requestedCaseIds.size > 0 && selectedCases.length !== requestedCaseIds.size) {
  const known = new Set(cases.map((testCase) => testCase.id));
  const unknown = [...requestedCaseIds].filter((id) => !known.has(id));
  throw new Error(`Unknown Oracle-v2 case id(s): ${unknown.join(", ")}.`);
}

const rscript = await findRscript();
if (rscript === undefined) {
  console.log("SKIP recursive R oracle v2: Rscript is not installed or not on PATH.");
  process.exit(0);
}
assertNormativeR(rscript);

const observerPath = path.join(root, "conformance", "oracle-v2-observer.R");
const observerSource = await readFile(observerPath, "utf8");
const { createR } = await import(
  pathToFileURL(path.join(root, "packages", "nativr", "dist", "index.js")).href
);
const assetRoot = path.join(root, "packages", "nativr", "dist", "assets");
const runtimeWasm = await readFile(path.join(assetRoot, "web-tree-sitter.wasm"));
const grammarWasm = await readFile(path.join(assetRoot, "tree-sitter-r.wasm"));
const bundledEntry = (
  await readFile(path.join(root, "packages", "nativr", "dist", "index.js"), "utf8")
).includes("./chunks/");
const runtime = await createR({
  execution: "inline",
  runtimeProfile: "package-test",
  assets: {
    treeSitterRuntimeWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${runtimeWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "web-tree-sitter.wasm")),
    rGrammarWasm: bundledEntry
      ? new URL(`data:application/wasm;base64,${grammarWasm.toString("base64")}`)
      : pathToFileURL(path.join(assetRoot, "tree-sitter-r.wasm")),
  },
});

let failures = 0;
for (const testCase of selectedCases) {
  await runtime.reset();
  if (process.env.NATIVR_ORACLE_TRACE === "1") {
    console.log(`RUN ${testCase.id}: evaluating NativR observation graph`);
  }
  const wrapper = `${observerSource}\nlocal({\n  .result <- withVisible({\n${testCase.code}\n  })\n  .graph <- nativr_oracle_observe_graph(.result$value)\n  list(root = .graph$root, graph = .graph$graph, visible = .result$visible)\n})`;
  try {
    const result = await runtime.evalDetailed(wrapper);
    if (process.env.NATIVR_ORACLE_TRACE === "1") {
      console.log(`RUN ${testCase.id}: evaluating GNU R observation graph`);
    }
    const payload = snapshotToPlain(result.raw);
    const actual = {
      schemaVersion: 2,
      outcome: "value",
      root: payload.root,
      graph: payload.graph,
      conditions: result.warnings.map((warning, index) => ({
        kind: "warning",
        classes: warning.classes ?? ["simpleWarning", "warning", "condition"],
        message: warning.message,
        call: warning.call ?? null,
        order: index + 1,
      })),
      streams: {
        stdout: result.output
          .filter((event) => event.stream === "stdout")
          .map((event) => event.text)
          .join(""),
        stderr: "",
        messages: result.output
          .filter((event) => event.stream === "message")
          .map((event) => event.text)
          .join(""),
      },
      visible: payload.visible,
    };
    const oracle = await runOracle(rscript, observerPath, testCase.code);
    const comparison = compareOraclePayload(actual, oracle, testCase);
    if (!comparison.equal) {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}\n  Difference: ${comparison.difference}\n  R:      ${JSON.stringify(oracle)}\n  NativR: ${JSON.stringify(actual)}`,
      );
    } else {
      console.log(`PASS ${testCase.id} [${testCase.policy}]`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.id}: ${error instanceof Error ? error.stack : String(error)}`);
  }
}

await runtime.dispose();
if (failures > 0) process.exitCode = 1;
else
  console.log(
    `Recursive live R oracle v2: ${selectedCases.length}/${selectedCases.length} passed.`,
  );

function snapshotToPlain(snapshot) {
  if (snapshot.type === "null") return null;
  if (snapshot.type === "list" || snapshot.type === "pairlist") {
    const values = snapshot.values.map(snapshotToPlain);
    const names = snapshot.names;
    if (
      names !== undefined &&
      names.length === values.length &&
      names.every((name) => name.length > 0) &&
      new Set(names).size === names.length
    ) {
      return Object.fromEntries(names.map((name, index) => [name, values[index]]));
    }
    return values;
  }
  if (snapshot.type === "complex") {
    const values = snapshot.real.map((real, index) => ({
      real,
      imaginary: snapshot.imaginary[index],
    }));
    return values.length === 1 ? values[0] : values;
  }
  if (snapshot.type === "formula") return { ...snapshot };
  if (snapshot.type === "symbol") return snapshot.name;
  if (snapshot.type === "language") return snapshot.source;
  if (snapshot.type === "expression") return [...snapshot.sources];
  const values = Array.from(snapshot.values, (value, index) => {
    if (snapshot.missing?.[index] === 1) return null;
    if (snapshot.type === "logical") return value === 1;
    return value;
  });
  return values.length === 1 ? values[0] : values;
}

function compareOraclePayload(actual, expected, testCase) {
  if (testCase.policy === "exact") {
    return JSON.stringify(actual) === JSON.stringify(expected)
      ? { equal: true }
      : { equal: false, difference: "exact observation graphs differ" };
  }
  return compareObservedValue(actual, expected, "$", testCase.tolerance, false);
}

function compareObservedValue(actual, expected, path, tolerance, numericPayload) {
  if (typeof actual === "number" && typeof expected === "number") {
    if (Object.is(actual, expected)) return { equal: true };
    if (
      numericPayload &&
      Number.isFinite(actual) &&
      Number.isFinite(expected) &&
      Math.abs(actual - expected) <=
        tolerance.absolute + tolerance.relative * Math.max(Math.abs(actual), Math.abs(expected))
    ) {
      return { equal: true };
    }
    return { equal: false, difference: `${path}: expected ${expected}, received ${actual}` };
  }
  if (
    actual === null ||
    expected === null ||
    typeof actual !== "object" ||
    typeof expected !== "object"
  ) {
    return Object.is(actual, expected)
      ? { equal: true }
      : {
          equal: false,
          difference: `${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
        };
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
      return {
        equal: false,
        difference: `${path}: expected array length ${expected.length}, received ${actual.length}`,
      };
    }
    for (let index = 0; index < actual.length; index += 1) {
      const result = compareObservedValue(
        actual[index],
        expected[index],
        `${path}[${index}]`,
        tolerance,
        numericPayload,
      );
      if (!result.equal) return result;
    }
    return { equal: true };
  }
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    return {
      equal: false,
      difference: `${path}: expected keys ${JSON.stringify(expectedKeys)}, received ${JSON.stringify(actualKeys)}`,
    };
  }
  const observedNumeric =
    actual.kind === expected.kind && (actual.kind === "double" || actual.kind === "complex");
  for (const key of actualKeys) {
    const result = compareObservedValue(
      actual[key],
      expected[key],
      `${path}.${key}`,
      tolerance,
      observedNumeric && (key === "value" || key === "real" || key === "imaginary"),
    );
    if (!result.equal) return result;
  }
  return { equal: true };
}

function runOracle(rscript, observerPath, code) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      rscript,
      ["--vanilla", path.join(root, "scripts", "r-oracle-v2.R"), observerPath],
      {
        env: { ...process.env, NATIVR_CASE: code },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (status) => {
      if (status !== 0) reject(new Error(`R oracle v2 failed: ${stderr}`));
      else resolve(JSON.parse(stdout));
    });
  });
}

function assertNormativeR(rscript) {
  const result = spawnSync(rscript, ["--vanilla", "-e", "cat(as.character(getRversion()))"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const detected = result.status === 0 ? result.stdout.trim() : "unknown";
  if (detected === "4.6.1" || process.env.NATIVR_ALLOW_NON_NORMATIVE_R === "1") return;
  throw new Error(
    `The recursive release-gating oracle requires GNU R 4.6.1; found ${detected}. Set NATIVR_ALLOW_NON_NORMATIVE_R=1 only for advisory local investigation.`,
  );
}

async function findRscript() {
  const availability = spawnSync("Rscript", ["--version"], { windowsHide: true });
  if (availability.error === undefined && availability.status === 0) return "Rscript";
  if (process.platform !== "win32") return undefined;
  const rRoot = path.join(process.env.ProgramFiles ?? String.raw`C:\Program Files`, "R");
  let installations;
  try {
    installations = await readdir(rRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const candidate of installations
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rRoot, entry.name, "bin", "Rscript.exe"))
    .sort()
    .reverse()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next installed R version.
    }
  }
  return undefined;
}
