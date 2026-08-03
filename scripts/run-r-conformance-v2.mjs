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
for (const testCase of cases) {
  if (!exactnessPolicies.has(testCase.policy)) {
    throw new Error(`Oracle-v2 case '${testCase.id}' has unknown policy '${testCase.policy}'.`);
  }
  if (testCase.policy !== "exact") {
    throw new Error(`Oracle-v2 policy '${testCase.policy}' is declared but not implemented yet.`);
  }
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
for (const testCase of cases) {
  await runtime.reset();
  const wrapper = `${observerSource}\nlocal({\n  .result <- withVisible({\n${testCase.code}\n  })\n  .graph <- nativr_oracle_observe_graph(.result$value)\n  list(root = .graph$root, graph = .graph$graph, visible = .result$visible)\n})`;
  try {
    const result = await runtime.evalDetailed(wrapper);
    const payload = snapshotToPlain(result.raw);
    const actual = {
      schemaVersion: 2,
      outcome: "value",
      root: payload.root,
      graph: payload.graph,
      conditions: result.warnings.map((warning, index) => ({
        kind: "warning",
        classes: [],
        message: warning.message,
        call: null,
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
    if (JSON.stringify(actual) !== JSON.stringify(oracle)) {
      failures += 1;
      console.error(
        `FAIL ${testCase.id}\n  R:      ${JSON.stringify(oracle)}\n  NativR: ${JSON.stringify(actual)}`,
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
else console.log(`Recursive live R oracle v2: ${cases.length}/${cases.length} passed.`);

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
